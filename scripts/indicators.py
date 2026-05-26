from __future__ import annotations

import numpy as np
import pandas as pd


def add_indicators(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy().sort_index()
    close = out["close"].astype(float)

    out["ma20"] = close.rolling(20, min_periods=5).mean()
    out["ma60"] = close.rolling(60, min_periods=15).mean()
    out["ma120"] = close.rolling(120, min_periods=30).mean()
    out["rsi14"] = rsi(close, 14)

    macd_line, macd_signal, macd_hist = macd(close)
    out["macd"] = macd_line
    out["macd_signal"] = macd_signal
    out["macd_hist"] = macd_hist

    middle = close.rolling(20, min_periods=10).mean()
    std = close.rolling(20, min_periods=10).std()
    out["bb_middle"] = middle
    out["bb_upper"] = middle + std * 2
    out["bb_lower"] = middle - std * 2

    if {"high", "low", "close"}.issubset(out.columns) and out[["high", "low"]].notna().any().all():
        out["atr14"] = atr(out, 14)
    else:
        out["atr14"] = np.nan

    out["pct_20d"] = close.pct_change(20) * 100
    out["pct_60d"] = close.pct_change(60) * 100
    out["pct_120d"] = close.pct_change(120) * 100
    return out


def rsi(close: pd.Series, window: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = gain.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    avg_loss = loss.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def macd(close: pd.Series, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[pd.Series, pd.Series, pd.Series]:
    fast_ema = close.ewm(span=fast, adjust=False).mean()
    slow_ema = close.ewm(span=slow, adjust=False).mean()
    macd_line = fast_ema - slow_ema
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    return macd_line, signal_line, macd_line - signal_line


def atr(df: pd.DataFrame, window: int = 14) -> pd.Series:
    high = df["high"].astype(float)
    low = df["low"].astype(float)
    prev_close = df["close"].astype(float).shift(1)
    tr = pd.concat(
        [(high - low), (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1 / window, min_periods=window, adjust=False).mean()


def regression_channel(df: pd.DataFrame, window: int = 60) -> dict:
    recent = df[["close"]].dropna().tail(window)
    if len(recent) < 10:
        return {"window": window, "slope": None, "direction": "sideways", "upper": [], "middle": [], "lower": []}

    y = recent["close"].to_numpy(dtype=float)
    x = np.arange(len(y), dtype=float)
    slope, intercept = np.polyfit(x, y, 1)
    middle_values = intercept + slope * x
    residual = y - middle_values
    channel_width = float(np.nanstd(residual, ddof=1) * 2) if len(y) > 1 else 0.0

    avg_price = float(np.nanmean(y))
    slope_threshold = max(avg_price * 0.0005, 0.02)
    if slope > slope_threshold:
        direction = "uptrend"
    elif slope < -slope_threshold:
        direction = "downtrend"
    else:
        direction = "sideways"

    dates = [idx.strftime("%Y-%m-%d") for idx in recent.index]
    return {
        "window": window,
        "slope": round(float(slope), 4),
        "direction": direction,
        "upper": [{"date": d, "value": round(float(v + channel_width), 4)} for d, v in zip(dates, middle_values)],
        "middle": [{"date": d, "value": round(float(v), 4)} for d, v in zip(dates, middle_values)],
        "lower": [{"date": d, "value": round(float(v - channel_width), 4)} for d, v in zip(dates, middle_values)],
    }


def trend_score(row: pd.Series) -> int:
    score = 0
    pairs = [
        ("close", "ma20"),
        ("ma20", "ma60"),
        ("ma60", "ma120"),
        ("macd", "macd_signal"),
    ]
    for left, right in pairs:
        if pd.isna(row.get(left)) or pd.isna(row.get(right)):
            continue
        score += 1 if row[left] > row[right] else -1 if row[left] < row[right] else 0

    if not pd.isna(row.get("rsi14")):
        score += 1 if row["rsi14"] > 50 else -1 if row["rsi14"] < 50 else 0
    return int(max(-5, min(5, score)))


def trend_label(score: int) -> str:
    if score >= 4:
        return "强势偏多"
    if score >= 2:
        return "偏多"
    if score >= -1:
        return "震荡/中性"
    if score >= -3:
        return "偏空"
    return "强势偏空"
