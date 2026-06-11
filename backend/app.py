from flask import Flask, request, jsonify
import pandas as pd
import joblib
import numpy as np
import os
import requests
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OPENWEATHER_API_KEY = "your-api-key-here"
model = joblib.load(
    os.path.join(BASE_DIR, "models", "maintenance_model.pkl")
)

feature_names = joblib.load(
    os.path.join(BASE_DIR, "models", "feature_names.pkl")
)
make_map = {
    "Toyota": 0,
    "Volvo": 1,
    "Tata": 2,
    "Ashok Leyland": 3
}

vehicle_map = {
    "Truck": 0,
    "Van": 1,
    "Bus": 2
}

road_map = {
    "Good": 0,
    "Moderate": 1,
    "Poor": 2
}
def get_weather(lat, lon):

    try:
        url = (
            f"https://api.openweathermap.org/data/2.5/weather"
            f"?lat={lat}"
            f"&lon={lon}"
            f"&appid={OPENWEATHER_API_KEY}"
        )

        response = requests.get(url, timeout=5)
        response.raise_for_status()

        weather_data = response.json()

        return weather_data["weather"][0]["main"]

    except Exception:
        return "Clear"


def map_weather(weather_name):

    weather_name = weather_name.lower()

    if weather_name == "rain":
        return 1

    elif weather_name == "snow":
        return 3

    elif weather_name in ["fog", "mist", "haze", "smoke"]:
        return 2

    else:
        return 0

def compute_features(data):

    load_utilization = (
        data["Actual_Load"] /
        data["Load_Capacity"]
    )

    vehicle_health_score = (
        100
        - 0.4 * data["Brake_Wear_Percentage"]
        - 0.4 * (100 - data["Oil_Quality"])
        - 2 * data["Vibration_Levels"]
    )

    vehicle_health_score = np.clip(
        vehicle_health_score,
        0,
        100
    )

    engine_stress = (
        0.3 * data["Engine_Temperature"]
        + 2 * data["Fuel_Consumption"]
    )

    brake_risk = (
        data["Brake_Wear_Percentage"]
        * load_utilization
    )

    maintenance_risk = (
        0.30 * data["Vehicle_Age"]
        + 0.20 * (data["Usage_Hours"] / 1000)
        + 0.25 * (brake_risk / 100)
        + 0.25 * (engine_stress / 100)
    ) * 10

    return (
        load_utilization,
        vehicle_health_score,
        engine_stress,
        brake_risk,
        maintenance_risk
    )
@app.route("/predict", methods=["POST"])
def predict():

    try:

        data = request.json

        make = make_map[data["Make_and_Model"]]
        vehicle = vehicle_map[data["Vehicle_Type"]]
        road = road_map[data["Road_Conditions"]]

        weather_name = get_weather(
            data["latitude"],
            data["longitude"]
        )

        weather = map_weather(weather_name)

        (
            load_util,
            health,
            engine_stress,
            brake_risk,
            risk_score
        ) = compute_features(data)

        sample = {
            "Make_and_Model": make,
            "Vehicle_Type": vehicle,
            "Vehicle_Age": data["Vehicle_Age"],
            "Usage_Hours": data["Usage_Hours"],
            "Load_Capacity": data["Load_Capacity"],
            "Actual_Load": data["Actual_Load"],
            "Engine_Temperature": data["Engine_Temperature"],
            "Fuel_Consumption": data["Fuel_Consumption"],
            "Oil_Quality": data["Oil_Quality"],
            "Brake_Wear_Percentage": data["Brake_Wear_Percentage"],
            "Tire_Pressure": data["Tire_Pressure"],
            "Vibration_Levels": data["Vibration_Levels"],
            "Weather_Conditions": weather,
            "Road_Conditions": road,
            "Average_Speed": data["Average_Speed"],
            "Load_Utilization": load_util,
            "Vehicle_Health_Score": health,
            "Engine_Stress_Index": engine_stress,
            "Brake_Risk_Index": brake_risk,
            "Maintenance_Risk_Score": risk_score
        }

        df = pd.DataFrame([sample])

        df = df[feature_names]

        pred = model.predict(df)[0]

        prob = model.predict_proba(df)[0][1]

        return jsonify({
            "prediction": int(pred),
            "maintenance_probability": round(float(prob) * 100, 2),
            "weather_detected": weather_name,
            "result": (
                "Maintenance Required"
                if pred == 1
                else "No Maintenance Required"
            )
        })

    except Exception as e:

        return jsonify({
            "error": str(e)
        }), 400
if __name__ == "__main__":
    app.run(
        debug=True,
        use_reloader=False
    )