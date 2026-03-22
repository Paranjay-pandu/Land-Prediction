from shutil import copy
import joblib
import os
from config import *
from functools import lru_cache
from fastapi import HTTPException
import pandas as pd
import copy

base_path = os.path.dirname(__file__)
path_m = os.path.join(base_path, "model.pkl")
last_known_path = os.path.join(base_path, "data/last_known_values.csv")

def load_model():
    try:
        model  = joblib.load(path_m)
        return model
    except Exception as e:
        print("Error loading model")
        return None

@lru_cache
def load_assets():
    model_by_indicator = joblib.load(path_m)
    metadata = META_DATA
    last_known = pd.read_csv(last_known_path)
    return model_by_indicator, metadata, last_known


def _validate(region, indicator, year, metadata):
    if region not in metadata.get("regions", []):
        raise HTTPException(status_code=400, detail=f"Invalid region: {region}")
    if indicator not in metadata.get("indicators", []):
        raise HTTPException(status_code=400, detail=f"Invalid indicator: {indicator}")

    start_year, end_year = metadata.get("prediction_range", [2025, 2035])
    if year < start_year or year > end_year:
        raise HTTPException(status_code=400, detail=f"Year must be between {start_year} and {end_year}")
    
    
    
def _make_feature_row(state, region, year, feature_columns):
    row = {}
    for col in feature_columns:
        if col == "region":
            row[col] = region
        elif col == "year":
            row[col] = year
        else:
            row[col] = float(state.get(col, 0.0))
    return pd.DataFrame([row], columns=feature_columns)


def _advance_state(state, predictions, indicators):
    for ind in indicators:
        lag1 = f"{ind}_lag1"
        lag2 = f"{ind}_lag2"
        growth = f"{ind}_growth_rate"

        prev = float(state.get(lag1, 0.0))
        current = float(predictions[ind])

        state[lag2] = prev
        state[lag1] = current
        state[growth] = ((current - prev) / prev * 100.0) if prev != 0 else 0.0


def predict_for_year(region, indicator, year):
    model_map, metadata, last_known = load_assets()
    _validate(region, indicator, year, metadata)

    region_rows = last_known[last_known["region"] == region]
    if region_rows.empty:
        raise HTTPException(status_code=400, detail=f"No baseline data for region: {region}")

    base = region_rows.sort_values("year").iloc[-1].to_dict()
    latest_known_year = int(base["year"])

    if year <= latest_known_year:
        return {
            "region": region,
            "indicator": indicator,
            "year": year,
            "value": float(base[indicator]),
            "source": "last_known_snapshot"
        }

    state = copy.deepcopy(base)
    indicators = metadata["indicators"]
    feature_columns = metadata["feature_columns"]
    yearly_prediction = {}

    for target_year in range(latest_known_year + 1, year + 1):
        yearly_prediction = {}
        for ind in indicators:
            X = _make_feature_row(state, region, target_year, feature_columns)
            pipe = model_map[ind]
            yearly_prediction[ind] = float(pipe.predict(X)[0])
        _advance_state(state, yearly_prediction, indicators)

    return {
        "region": region,
        "indicator": indicator,
        "year": year,
        "value": float(yearly_prediction[indicator]),
        "source": "model_forecast"
    }


def compare_two_regions(region1: str, region2: str, indicator: str, year: int):
    p1 = predict_for_year(region1, indicator, year)
    p2 = predict_for_year(region2, indicator, year)

    v1 = float(p1["value"])
    v2 = float(p2["value"])
    diff = v1 - v2
    pct_vs_region2 = (diff / v2 * 100.0) if v2 != 0 else None

    return {
        "year": year,
        "indicator": indicator,
        "region1": {"name": region1, "value": v1},
        "region2": {"name": region2, "value": v2},
        "difference": diff,
        "difference_percent_vs_region2": pct_vs_region2,
        "higher_region": region1 if v1 > v2 else region2 if v2 > v1 else "equal"
    }