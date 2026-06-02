from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from data_sources import choose_brent_source
from indicators import add_indicators, regression_channel, trend_label, trend_score
from levels import find_levels


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "public" / "data"
DISCLAIMER_CN = "本页面仅用于研究和信息展示，不构成投资建议。技术指标基于历史价格计算，不保证未来走势。"


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    remove_stale_files()
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    errors: list[str] = []

    raw, source, data_status, filter_meta = choose_brent_source(errors)
    previous_payload = load_existing_payload()

    if raw is None:
        previous_frame = payload_to_frame(previous_payload)
        if previous_payload.get("data_status") == "real" and previous_frame is not None and not previous_frame.empty:
            raw = previous_frame
            source = previous_payload.get("source", "Previous public/data/brent.json")
            data_status = "fallback_previous_static"
            filter_meta = payload_filter_meta(previous_payload)
            errors.append("Using previous public/data/brent.json because live Brent sources failed.")
        else:
            brent_payload = empty_brent_payload(now, source, errors, filter_meta)
            signals_payload = empty_signals_payload()
            metadata_payload = metadata(now, source, "no_real_data", errors, filter_meta)
            write_json(DATA_DIR / "brent.json", brent_payload)
            write_json(DATA_DIR / "signals.json", signals_payload)
            write_json(DATA_DIR / "metadata.json", metadata_payload)
            return

    brent_df, brent_payload = build_brent_payload(raw, source, data_status, now, filter_meta)
    signals_payload = {"brent": brent_signal(brent_df, brent_payload)}
    metadata_payload = metadata(now, source, data_status, errors, filter_meta)

    write_json(DATA_DIR / "brent.json", brent_payload)
    write_json(DATA_DIR / "signals.json", signals_payload)
    write_json(DATA_DIR / "metadata.json", metadata_payload)


def remove_stale_files() -> None:
    for name in ("wti.json", "spread.json"):
        path = DATA_DIR / name
        if path.exists():
            path.unlink()


def build_brent_payload(raw: pd.DataFrame, source: str, data_status: str, now: str, filter_meta: dict) -> tuple[pd.DataFrame, dict]:
    enriched = add_indicators(raw).tail(260)
    latest = enriched.dropna(subset=["close"]).iloc[-1]
    latest_close = float(latest["close"])
    levels = find_levels(enriched, latest_close)

    return enriched, {
        "symbol": "Brent",
        "source": source,
        "data_status": data_status,
        "last_updated": now,
        "last_raw_data_date": filter_meta.get("last_raw_data_date"),
        "latest_data_date": filter_meta.get("latest_data_date"),
        "dropped_incomplete_latest_bar": bool(filter_meta.get("dropped_incomplete_latest_bar", False)),
        "yahoo_close_mode": filter_meta.get("yahoo_close_mode"),
        "early_fixed_close_used": bool(filter_meta.get("early_fixed_close_used", False)),
        "duplicated_top_date_detected": bool(filter_meta.get("duplicated_top_date_detected", False)),
        "discarded_realtime_top_row": bool(filter_meta.get("discarded_realtime_top_row", False)),
        "timezone_for_daily_cutoff": filter_meta.get("timezone_for_daily_cutoff"),
        "data": frame_records(enriched),
        "levels": levels,
        "channel": regression_channel(enriched, 60),
    }


def brent_signal(df: pd.DataFrame, payload: dict) -> dict:
    latest = df.dropna(subset=["close"]).iloc[-1]
    score = trend_score(latest)
    supports = payload["levels"]["supports"]
    resistances = payload["levels"]["resistances"]
    support_text = f"{supports[0]['label']} {supports[0]['price']:.2f}美元支撑" if supports else "下方支撑"
    resistance_text = f"{resistances[0]['label']} {resistances[0]['price']:.2f}美元阻力" if resistances else "上方阻力"
    breakdown = score_breakdown(latest)

    rsi = latest.get("rsi14")
    atr = latest.get("atr14")
    macd = latest.get("macd")
    macd_signal = latest.get("macd_signal")
    if not pd.isna(macd) and not pd.isna(macd_signal) and not pd.isna(rsi) and macd > macd_signal and rsi >= 50:
        momentum_label = "动能增强"
    elif not pd.isna(macd) and not pd.isna(macd_signal) and not pd.isna(rsi) and macd < macd_signal and rsi < 50:
        momentum_label = "动能转弱"
    else:
        momentum_label = "动能中性"
    volatility_label = volatility_text(float(atr) if not pd.isna(atr) else None, float(latest["close"]))

    weak_items = [item["explain"] for item in breakdown if item["value"] < 0]
    strong_items = [item["explain"] for item in breakdown if item["value"] > 0]
    first_clause = weak_items[0] if weak_items else strong_items[0] if strong_items else "关键指标接近中性"
    second_clause = strong_items[0] if weak_items and strong_items else "各项指标合计显示当前结构偏向" + trend_label(score)

    return {
        "latest_price": clean_number(latest["close"]),
        "latest_data_date": payload.get("latest_data_date"),
        "trend_score": score,
        "trend_label": trend_label(score),
        "momentum_label": momentum_label,
        "volatility_label": volatility_label,
        "summary_cn": f"Brent {first_clause}；{second_clause}。综合评分为 {score}/5，技术面判断为{trend_label(score)}。上方关注{resistance_text}，下方关注{support_text}。",
        "score_breakdown": breakdown,
    }


def score_breakdown(row: pd.Series) -> list[dict[str, Any]]:
    rules = [
        ("价格 vs MA20", "close", "ma20", "当前价格高于20日均线，短线偏强", "当前价格低于20日均线，短线偏弱"),
        ("MA20 vs MA60", "ma20", "ma60", "20日均线高于60日均线，中期趋势偏强", "20日均线低于60日均线，中期趋势偏弱"),
        ("MA60 vs MA120", "ma60", "ma120", "60日均线高于120日均线，中长期结构偏强", "60日均线低于120日均线，中长期结构偏弱"),
        ("MACD快线 vs 慢线", "macd", "macd_signal", "MACD快线高于慢线，说明短期动能强于前期趋势，动能偏强", "MACD快线低于慢线，说明短期动能弱于前期趋势，动能转弱"),
    ]

    items = []
    for name, left, right, bull_text, bear_text in rules:
        left_value = row.get(left)
        right_value = row.get(right)
        if pd.isna(left_value) or pd.isna(right_value):
            items.append({"name": name, "value": 0, "explain": "数据不足，暂不计分"})
        elif left_value > right_value:
            items.append({"name": name, "value": 1, "explain": bull_text})
        elif left_value < right_value:
            items.append({"name": name, "value": -1, "explain": bear_text})
        else:
            items.append({"name": name, "value": 0, "explain": "两者接近，暂作中性"})

    rsi = row.get("rsi14")
    if pd.isna(rsi):
        items.append({"name": "RSI14", "value": 0, "explain": "RSI数据不足，暂不计分"})
    elif rsi > 50:
        items.append({"name": "RSI14", "value": 1, "explain": "RSI高于50，短期动能偏强"})
    elif rsi < 50:
        items.append({"name": "RSI14", "value": -1, "explain": "RSI低于50，短期动能偏弱"})
    else:
        items.append({"name": "RSI14", "value": 0, "explain": "RSI接近50，短期动能中性"})
    return items


def volatility_text(atr: float | None, close: float) -> str:
    if atr is None or close <= 0:
        return "波动率暂无ATR数据"
    ratio = atr / close
    if ratio >= 0.04:
        return "波动率偏高"
    if ratio >= 0.02:
        return "波动率中等"
    return "波动率偏低"


def metadata(now: str, source: str, data_status: str, errors: list[str], filter_meta: dict) -> dict:
    return {
        "last_updated": now,
        "data_sources": [source],
        "data_status": data_status,
        "last_raw_data_date": filter_meta.get("last_raw_data_date"),
        "latest_data_date": filter_meta.get("latest_data_date"),
        "dropped_incomplete_latest_bar": bool(filter_meta.get("dropped_incomplete_latest_bar", False)),
        "dropped_rows": int(filter_meta.get("dropped_rows", 0) or 0),
        "yahoo_close_mode": filter_meta.get("yahoo_close_mode"),
        "early_fixed_close_used": bool(filter_meta.get("early_fixed_close_used", False)),
        "duplicated_top_date_detected": bool(filter_meta.get("duplicated_top_date_detected", False)),
        "discarded_realtime_top_row": bool(filter_meta.get("discarded_realtime_top_row", False)),
        "timezone_for_daily_cutoff": filter_meta.get("timezone_for_daily_cutoff"),
        "analysis_frequency": "daily_close",
        "uses_incomplete_intraday_bar": False,
        "status": "ok" if data_status == "real" else data_status,
        "files": ["brent.json", "signals.json", "metadata.json"],
        "errors": errors[-10:],
        "disclaimer_cn": DISCLAIMER_CN,
    }


def empty_brent_payload(now: str, source: str, errors: list[str], filter_meta: dict | None = None) -> dict:
    filter_meta = filter_meta or {}
    return {
        "symbol": "Brent",
        "source": source,
        "data_status": "no_real_data",
        "last_updated": now,
        "last_raw_data_date": filter_meta.get("last_raw_data_date"),
        "latest_data_date": filter_meta.get("latest_data_date"),
        "dropped_incomplete_latest_bar": bool(filter_meta.get("dropped_incomplete_latest_bar", False)),
        "yahoo_close_mode": filter_meta.get("yahoo_close_mode"),
        "early_fixed_close_used": bool(filter_meta.get("early_fixed_close_used", False)),
        "duplicated_top_date_detected": bool(filter_meta.get("duplicated_top_date_detected", False)),
        "discarded_realtime_top_row": bool(filter_meta.get("discarded_realtime_top_row", False)),
        "timezone_for_daily_cutoff": filter_meta.get("timezone_for_daily_cutoff"),
        "data": [],
        "levels": {"supports": [], "resistances": []},
        "channel": {"window": 60, "slope": None, "direction": "sideways", "upper": [], "middle": [], "lower": []},
        "message_cn": "暂无真实行情数据，请检查 yfinance 或配置 FRED_API_KEY。",
        "errors": errors[-10:],
    }


def empty_signals_payload() -> dict:
    return {
        "brent": {
            "latest_price": None,
            "latest_data_date": None,
            "trend_score": 0,
            "trend_label": "暂无数据",
            "momentum_label": "暂无数据",
            "volatility_label": "暂无数据",
            "summary_cn": "暂无真实行情数据，请检查 yfinance 或配置 FRED_API_KEY。",
            "score_breakdown": [],
        }
    }


def load_existing_payload() -> dict:
    path = DATA_DIR / "brent.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def payload_to_frame(payload: dict) -> pd.DataFrame | None:
    rows = payload.get("data", [])
    if not rows:
        return None
    try:
        df = pd.DataFrame(rows)
        df["date"] = pd.to_datetime(df["date"])
        for col in ["open", "high", "low", "close"]:
            if col not in df.columns:
                df[col] = np.nan
        return df.set_index("date")[["open", "high", "low", "close"]].sort_index()
    except Exception:
        return None


def payload_filter_meta(payload: dict) -> dict:
    rows = payload.get("data", [])
    latest_data_date = payload.get("latest_data_date")
    if not latest_data_date and rows:
        latest_data_date = rows[-1].get("date")
    return {
        "last_raw_data_date": payload.get("last_raw_data_date", latest_data_date),
        "latest_data_date": latest_data_date,
        "dropped_incomplete_latest_bar": bool(payload.get("dropped_incomplete_latest_bar", False)),
        "dropped_rows": int(payload.get("dropped_rows", 0) or 0),
        "yahoo_close_mode": payload.get("yahoo_close_mode", "normal_daily_close"),
        "early_fixed_close_used": bool(payload.get("early_fixed_close_used", False)),
        "duplicated_top_date_detected": bool(payload.get("duplicated_top_date_detected", False)),
        "discarded_realtime_top_row": bool(payload.get("discarded_realtime_top_row", False)),
        "timezone_for_daily_cutoff": payload.get("timezone_for_daily_cutoff", "America/New_York"),
    }


def frame_records(df: pd.DataFrame) -> list[dict[str, Any]]:
    out = df.copy().reset_index(names="date")
    out["date"] = pd.to_datetime(out["date"]).dt.strftime("%Y-%m-%d")
    return [{key: clean_number(value) for key, value in row.items()} for row in out.to_dict(orient="records")]


def clean_number(value: Any) -> Any:
    if isinstance(value, pd.Timestamp):
        return value.strftime("%Y-%m-%d")
    if value is None:
        return None
    if isinstance(value, (float, np.floating)):
        if math.isnan(float(value)) or math.isinf(float(value)):
            return None
        return round(float(value), 4)
    if isinstance(value, (int, np.integer)):
        return int(value)
    return value


def write_json(path: Path, payload: dict) -> None:
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


if __name__ == "__main__":
    main()
