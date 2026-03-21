import copy
import asyncio
from fastapi import FastAPI, Query
from config import *
import joblib
from fastapi.middleware.cors import CORSMiddleware
from model import *
from analytics import *
predic_model = load_model()

app = FastAPI()
origins = [
    "http://localhost:5173"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,      
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return RESOURCES

@app.get("/regions")
def get_regions():
    meta_data = copy.deepcopy(META_DATA)
    regions = meta_data.get("regions", [])
    return regions

@app.get("/indicators")
def get_indicators():
    meta_data = copy.deepcopy(META_DATA)
    indicators = meta_data.get("indicators", [])
    return indicators

@app.get("/options/indicators")
def get_indicator_options():
    meta_data = copy.deepcopy(META_DATA)
    indicators_labels = meta_data.get("indicator_labels", {})
    return indicators_labels

@app.get("/options/sidebar")
def get_sidebar_options():
    side_bar_options = SIDEBAR_OPTIONS
    return side_bar_options

@app.get("/options/predict")
def get_predict_options():
    prediction_range = META_DATA.get("prediction_range", [2025, 2035])
    return {"prediction_range": prediction_range}

@app.get("/predict")
def predict(
    region: str = Query(...),
    indicator: str = Query(...),
    year: int = Query(...),
):
    return predict_for_year(region=region, indicator=indicator, year=year)

@app.get("/compare")
def compare(
    region1: str = Query(...),
    region2: str = Query(...),
    indicator: str = Query(...),
    year: int = Query(...),
):
    return compare_two_regions(
        region1=region1,
        region2=region2,
        indicator=indicator,
        year=year,
    )
    
    

@app.get("/analytics/timeseries")
def analytics_timeseries(
    indicator: str = Query(...),
    region = Query(None),
    ma_window: int = Query(3),
):
    return get_timeseries(indicator=indicator, region=region, ma_window=ma_window)

@app.get("/analytics/outliers")
def analytics_outliers(indicator: str = Query(...)):
    return get_outliers(indicator=indicator)

@app.get("/analytics/correlation")
def analytics_correlation(indicators: Optional[List[str]] = Query(None)):
    return get_correlation(indicators=indicators)

@app.get("/analytics/stats/regions")
def analytics_region_stats(indicator: Optional[str] = Query(None)):
    return get_region_statistics(indicator=indicator)
