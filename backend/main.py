import copy
import asyncio
from fastapi import FastAPI
from config import *
import joblib
from fastapi.middleware.cors import CORSMiddleware

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

@app.get("/indicators/options")
def get_indicator_options():
    meta_data = copy.deepcopy(META_DATA)
    indicators_labels = meta_data.get("indicator_labels", {})
    return indicators_labels

@app.get("/options/sidebar")
def get_sidebar_options():
    side_bar_options = SIDEBAR_OPTIONS
    return side_bar_options
    

# export const getPredictedPrice = async (region: string, indicator: string, year: number) => {
#     try {
#         const response = await api.get("/predict", {params: { region, indicator, year}
#         });
#         return response.data;
#     } catch(err) {
#         console.error("Error in api service: ", err)
#     }
# }
