from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd
import requests


FRED_BRENT_SERIES = "DCOILBRENTEU"
YFINANCE_BRENT_TICKER = "BZ=F"
YAHOO_CLOSE_MODE_NORMAL = "normal_daily_close"
VALID_YAHOO_CLOSE_MODES = {YAHOO_CLOSE_MODE_NORMAL}
DAILY_CUTOFF_TZ = "America/New_York"


def yahoo_close_mode() -> str:
    mode = os.getenv("YAHOO_CLOSE_MODE", YAHOO_CLOSE_MODE_NORMAL).strip() or YAHOO_CLOSE_MODE_NORMAL
    if mode not in VALID_YAHOO_CLOSE_MODES:
        raise RuntimeError(
            f"Invalid YAHOO_CLOSE_MODE={mode!r}. "
            f"Expected one of: {', '.join(sorted(VALID_YAHOO_CLOSE_MODES))}"
        )
    return mode


def base_filter_meta(mode: str | None = None) -> dict:
    return {
        "last_raw_data_date": None,
        "latest_data_date": None,
        "dropped_incomplete_latest_bar": False,
        "dropped_rows": 0,
        "yahoo_close_mode": mode or yahoo_close_mode(),
        "timezone_for_daily_cutoff": DAILY_CUTOFF_TZ,
    }


def drop_incomplete_daily_bar(
    df: pd.DataFrame,
    date_col: str = "date",
    now_utc: datetime | None = None,
    mode: str | None = None,
) -> tuple[pd.DataFrame, dict]:
    """
    Remove daily bars whose date is today or later in America/New_York.

    This dashboard is designed for daily close-based technical analysis,
    so it should not use an intraday/incomplete daily bar.
    """
    if now_utc is None:
        now_utc = datetime.now(timezone.utc)

    cutoff_date = now_utc.astimezone(ZoneInfo(DAILY_CUTOFF_TZ)).date()
    meta = base_filter_meta(mode)

    if df is None or df.empty:
        return df.copy() if df is not None else pd.DataFrame(), meta

    out = df.copy()
    if date_col in out.columns:
        dates = pd.to_datetime(out[date_col]).dt.date
    else:
        dates = pd.to_datetime(out.index).date

    meta["last_raw_data_date"] = max(dates).strftime("%Y-%m-%d")
    keep_mask = dates < cutoff_date
    cleaned = out.loc[keep_mask].copy()
    dropped_rows = int((~keep_mask).sum())

    meta["dropped_rows"] = dropped_rows
    meta["dropped_incomplete_latest_bar"] = dropped_rows > 0
    if not cleaned.empty:
        if date_col in cleaned.columns:
            latest_date = pd.to_datetime(cleaned[date_col]).dt.date.max()
        else:
            latest_date = pd.to_datetime(cleaned.index).date.max()
        meta["latest_data_date"] = latest_date.strftime("%Y-%m-%d")

    return cleaned, meta


def fetch_fred_brent_close(years: int = 3) -> pd.DataFrame:
    api_key = os.getenv("FRED_API_KEY")
    if not api_key:
        raise RuntimeError("FRED_API_KEY is not configured")

    start = (datetime.now(timezone.utc) - timedelta(days=365 * years + 30)).strftime("%Y-%m-%d")
    response = requests.get(
        "https://api.stlouisfed.org/fred/series/observations",
        params={
            "series_id": FRED_BRENT_SERIES,
            "api_key": api_key,
            "file_type": "json",
            "observation_start": start,
            "sort_order": "asc",
        },
        timeout=20,
    )
    response.raise_for_status()

    rows = []
    for item in response.json().get("observations", []):
        value = item.get("value")
        if value in (None, "."):
            continue
        rows.append({"date": item["date"], "close": float(value)})

    if not rows:
        raise RuntimeError("FRED returned no usable Brent rows")

    df = pd.DataFrame(rows)
    df["date"] = pd.to_datetime(df["date"])
    df = df.set_index("date").sort_index()
    df["open"] = np.nan
    df["high"] = np.nan
    df["low"] = np.nan
    return df[["open", "high", "low", "close"]]


def fetch_yfinance_brent_ohlc(years: int = 3) -> pd.DataFrame:
    try:
        import yfinance as yf
    except ModuleNotFoundError as exc:  # pragma: no cover - depends on optional runtime package
        raise RuntimeError("yfinance is not installed") from exc
    except Exception as exc:  # pragma: no cover - depends on optional runtime package
        raise RuntimeError(f"yfinance import failed: {exc}") from exc

    df = yf.download(
        YFINANCE_BRENT_TICKER,
        period=f"{years}y",
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False,
    )
    if df is None or df.empty:
        raise RuntimeError(f"yfinance returned no rows for {YFINANCE_BRENT_TICKER}")

    if isinstance(df.columns, pd.MultiIndex):
        df.columns = [col[0] for col in df.columns]

    df = df.rename(columns=str.lower)
    required = ["open", "high", "low", "close"]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise RuntimeError(f"yfinance missing columns: {', '.join(missing)}")

    out = df[required].copy()
    out.index = pd.to_datetime(out.index).tz_localize(None)
    return out.dropna(subset=["open", "high", "low", "close"]).sort_index()


def choose_brent_source(errors: list[str]) -> tuple[pd.DataFrame | None, str, str, dict]:
    """Return one coherent Brent price source. Never mix yfinance OHLC with FRED close."""
    mode = yahoo_close_mode()
    try:
        yf_df = fetch_yfinance_brent_ohlc()
        yf_df, filter_meta = drop_incomplete_daily_bar(yf_df, mode=mode)
        if yf_df.empty:
            raise RuntimeError("yfinance returned no complete daily bars after filtering")
        return yf_df, "Yahoo Finance Brent futures BZ=F", "real", filter_meta
    except Exception as exc:
        errors.append(f"Brent yfinance failed: {exc}")

    try:
        fred_df = fetch_fred_brent_close()
        fred_df, filter_meta = drop_incomplete_daily_bar(fred_df, mode=mode)
        if fred_df.empty:
            raise RuntimeError("FRED returned no complete daily bars after filtering")
        return fred_df, "FRED/EIA Brent spot DCOILBRENTEU", "real", filter_meta
    except Exception as exc:
        errors.append(f"Brent FRED failed: {exc}")

    return None, "No live Brent data source available", "no_real_data", base_filter_meta(mode)
