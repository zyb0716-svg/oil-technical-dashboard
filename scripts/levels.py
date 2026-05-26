from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np
import pandas as pd


@dataclass(frozen=True)
class Pivot:
    price: float
    date: pd.Timestamp
    kind: str
    key: str


def find_levels(df: pd.DataFrame, latest_close: float, lookbacks: tuple[int, ...] = (20, 60, 120), n: int = 3) -> dict:
    low_pivots: dict[str, Pivot] = {}
    high_pivots: dict[str, Pivot] = {}

    for lookback in lookbacks:
        recent = df.tail(lookback)
        for pivot in _pivots(recent, "low", "local_low", n):
            low_pivots[pivot.key] = pivot
        for pivot in _pivots(recent, "high", "local_high", n):
            high_pivots[pivot.key] = pivot

    threshold = max(latest_close * 0.005, 0.1)
    supports = _cluster([p for p in low_pivots.values() if p.price < latest_close], threshold, latest_close, "S")
    resistances = _cluster([p for p in high_pivots.values() if p.price > latest_close], threshold, latest_close, "R")

    return {
        "supports": supports[:3],
        "resistances": resistances[:3],
    }


def _pivots(df: pd.DataFrame, column: str, kind: str, n: int) -> list[Pivot]:
    if df.empty or "close" not in df.columns:
        return []

    if column not in df.columns or df[column].isna().all():
        column = "close"

    series = df[column].fillna(df["close"]).astype(float)
    values = series.to_numpy()
    pivots: list[Pivot] = []

    for i in range(n, len(values) - n):
        window = values[i - n : i + n + 1]
        value = values[i]
        date = series.index[i]
        if kind == "local_low" and value < np.nanmin(np.delete(window, n)):
            pivots.append(Pivot(float(value), date, f"local_low_{len(df)}d", f"{date:%Y-%m-%d}-low"))
        if kind == "local_high" and value > np.nanmax(np.delete(window, n)):
            pivots.append(Pivot(float(value), date, f"local_high_{len(df)}d", f"{date:%Y-%m-%d}-high"))
    return pivots


def _cluster(pivots: list[Pivot], threshold: float, latest_close: float, prefix: str) -> list[dict]:
    pivots = sorted(pivots, key=lambda p: p.price)
    clusters: list[list[Pivot]] = []

    for pivot in pivots:
        for cluster in clusters:
            center = sum(item.price for item in cluster) / len(cluster)
            if abs(pivot.price - center) <= threshold:
                cluster.append(pivot)
                break
        else:
            clusters.append([pivot])

    latest_date = max((p.date for p in pivots), default=None)
    levels = []
    for cluster in clusters:
        price = float(np.mean([p.price for p in cluster]))
        latest_touch = max(p.date for p in cluster)
        recency_score = 0
        if latest_date is not None:
            age_days = min((latest_date - latest_touch).days, 180)
            recency_score = max(0, 3 - math.floor(age_days / 45))
        strength = int(max(1, min(5, len(cluster) + recency_score)))
        levels.append(
            {
                "price": round(price, 2),
                "type": cluster[-1].kind,
                "strength": strength,
            }
        )

    levels.sort(key=lambda item: abs(item["price"] - latest_close))
    for idx, level in enumerate(levels, start=1):
        level["label"] = f"{prefix}{idx}"
    return levels
