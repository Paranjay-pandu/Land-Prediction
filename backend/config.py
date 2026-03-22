RESOURCES = {
    "MONGO_URL": "mongodb://localhost:27017",
    "MONGO_DB": "mydatabase",
}

META_DATA = {
  "regions": [
    "East Midlands",
    "East of England",
    "London",
    "North East",
    "North West",
    "South East",
    "South West",
    "West Midlands",
    "Yorkshire and The Humber"
  ],
  "indicators": [
    "population",
    "employment_rate",
    "average_house_price",
    "rental_index",
    "housing_completions"
  ],
  "indicator_labels": {
    "population": "Population",
    "employment_rate": "Employment Rate (%)",
    "average_house_price": "Average House Price (\u00a3)",
    "rental_index": "Rental Price Index",
    "housing_completions": "Housing Completions"
  },
  "train_year_range": [
    2007,
    2019
  ],
  "prediction_range": [
    2025,
    2035
  ],
  "feature_columns": [
    "year",
    "population_lag1",
    "population_lag2",
    "employment_rate_lag1",
    "employment_rate_lag2",
    "average_house_price_lag1",
    "average_house_price_lag2",
    "rental_index_lag1",
    "rental_index_lag2",
    "housing_completions_lag1",
    "housing_completions_lag2",
    "population_growth_rate",
    "employment_rate_growth_rate",
    "average_house_price_growth_rate",
    "rental_index_growth_rate",
    "housing_completions_growth_rate",
    "region"
  ],
  "mape_target": 8.0,
  "model_type": "LinearRegression",
  "trained_at": "2026-03-19T20:09:54.809429"
}

SIDEBAR_OPTIONS = {
  "Home": "/home",
  "Prediction": "/predict",
  "Market Insights": "/analytics",
  "Compare": "/compare",
}