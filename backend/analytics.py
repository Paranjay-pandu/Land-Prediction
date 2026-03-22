import os
import json
from functools import lru_cache
from typing import Optional, List, Dict, Any

import joblib
import pandas as pd
from fastapi import HTTPException

BASE_DIR = os.path.dirname(__file__)
MODEL_PATH = os.path.join(BASE_DIR, "model.pkl")

# You can set this from env in production:
ANALYTICS_DATA_PATH= os.path.join(BASE_DIR, "data/ml_ready_dataset.csv")
DEFAULT_ANALYTICS_DATA_PATH = ANALYTICS_DATA_PATH

DEFAULT_METADATA_PATH = os.getenv(
    "METADATA_PATH",
    os.path.join(BASE_DIR, "metadata.json")
)

INDICATORS_FALLBACK = [
    "population",
    "employment_rate",
    "average_house_price",
    "rental_index",
    "housing_completions",
]


@lru_cache
def load_model():
    try:
        return joblib.load(MODEL_PATH)
    except Exception as exc:
        raise RuntimeError(f"Error loading model from {MODEL_PATH}: {exc}") from exc


@lru_cache
def load_metadata() -> Dict[str, Any]:
    if os.path.exists(DEFAULT_METADATA_PATH):
        with open(DEFAULT_METADATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {
        "indicators": INDICATORS_FALLBACK
    }


@lru_cache
def load_analytics_data() -> pd.DataFrame:
    if not os.path.exists(DEFAULT_ANALYTICS_DATA_PATH):
        raise RuntimeError(
            f"Analytics dataset not found. Set ANALYTICS_DATA_PATH env var or place file next to backend. {DEFAULT_ANALYTICS_DATA_PATH} {ANALYTICS_DATA_PATH}"
        )
    df = pd.read_csv(DEFAULT_ANALYTICS_DATA_PATH)
    required = {"region", "year"}
    missing = required - set(df.columns)
    if missing:
        raise RuntimeError(f"Analytics dataset missing required columns: {sorted(missing)}")
    df["year"] = pd.to_numeric(df["year"], errors="coerce")
    df = df.dropna(subset=["year"]).copy()
    df["year"] = df["year"].astype(int)
    return df.sort_values(["region", "year"]).reset_index(drop=True)


def get_indicators() -> List[str]:
    metadata = load_metadata()
    indicators = metadata.get("indicators", [])
    if indicators:
        return indicators

    df = load_analytics_data()
    return [c for c in INDICATORS_FALLBACK if c in df.columns]


def _validate_indicator(indicator: str) -> None:
    if indicator not in get_indicators():
        raise HTTPException(status_code=400, detail=f"Unknown indicator: {indicator}")


def _validate_region(region: Optional[str], df: pd.DataFrame) -> None:
    if region is None:
        return
    if region not in set(df["region"].unique()):
        raise HTTPException(status_code=400, detail=f"Unknown region: {region}")


def get_timeseries(
    indicator: str,
    region: Optional[str] = None,
    ma_window: int = 3
) -> Dict[str, Any]:
    _validate_indicator(indicator)
    if ma_window not in [3, 5]:
        raise HTTPException(status_code=400, detail="ma_window must be 3 or 5")

    df = load_analytics_data().copy()
    _validate_region(region, df)

    if region:
        df = df[df["region"] == region].copy()

    df["moving_average"] = (
        df.groupby("region")[indicator]
        .transform(lambda s: s.rolling(window=ma_window, min_periods=1).mean())
    )
    df["growth_yoy"] = (
        df.groupby("region")[indicator].pct_change() * 100.0
    )

    rows = df[["region", "year", indicator, "moving_average", "growth_yoy"]].copy()
    rows = rows.rename(columns={indicator: "value"})
    rows["growth_yoy"] = rows["growth_yoy"].fillna(0.0)

    return {
        "indicator": indicator,
        "region": region,
        "ma_window": ma_window,
        "series": rows.to_dict(orient="records")
    }


def get_outliers(indicator: str) -> Dict[str, Any]:
    _validate_indicator(indicator)
    df = load_analytics_data()

    q1 = df[indicator].quantile(0.25)
    q3 = df[indicator].quantile(0.75)
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr

    outliers = df[(df[indicator] < lower) | (df[indicator] > upper)][["region", "year", indicator]]
    outliers = outliers.rename(columns={indicator: "value"})

    return {
        "indicator": indicator,
        "bounds": {"lower": float(lower), "upper": float(upper)},
        "count": int(len(outliers)),
        "outliers": outliers.to_dict(orient="records")
    }


def get_correlation(indicators: Optional[List[str]] = None) -> Dict[str, Any]:
    df = load_analytics_data()
    cols = indicators if indicators else get_indicators()

    invalid = [c for c in cols if c not in df.columns]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid columns for correlation: {invalid}")

    corr = df[cols].corr().round(4)
    pairs = []
    for i, c1 in enumerate(cols):
        for c2 in cols[i + 1:]:
            pairs.append({
                "x": c1,
                "y": c2,
                "corr": float(corr.loc[c1, c2])
            })

    top_pairs = sorted(pairs, key=lambda x: abs(x["corr"]), reverse=True)[:10]

    return {
        "columns": cols,
        "matrix": corr.to_dict(),
        "top_pairs": top_pairs
    }


def get_region_statistics(indicator: Optional[str] = None) -> Dict[str, Any]:
    df = load_analytics_data()
    indicators = [indicator] if indicator else get_indicators()

    for col in indicators:
        _validate_indicator(col)

    payload = {}
    for col in indicators:
        stats = (
            df.groupby("region")[col]
            .agg(["mean", "median", "std", "min", "max", "count"])
            .round(4)
            .reset_index()
        )
        payload[col] = stats.to_dict(orient="records")

    return {"stats": payload}