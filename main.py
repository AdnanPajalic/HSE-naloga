import pandas as pd
from flask import Flask, jsonify, render_template, request
from utils import check_date_range, check_series_data
from controller import fetch_prices, fetch_generation
from constants import BIDDING_ZONES, COUNTRIES, CONTROL_AREAS

app = Flask(__name__)


@app.route("/")
def index():
    return render_template(
        "index.html",
        bidding_zones=BIDDING_ZONES,
        countries=COUNTRIES,
        control_areas=CONTROL_AREAS)


@app.route("/price")
def price():
    start = request.args.get("start")
    end = request.args.get("end")
    zone = request.args.get("zone")

    eic_code = BIDDING_ZONES[zone][0]

    result = check_date_range(start, end)
    
    start, end = result
 
    series_data = fetch_prices(eic_code, start, end)

    return check_series_data(series_data, "prices", zone)
    

@app.route("/generation")
def generation():
    start = request.args.get("start")
    end = request.args.get("end")
    zone = request.args.get("zone")
    # if the "location-type" parameter is missing, use defualt value "countries"
    location_type = request.args.get("location-type", "countries")

    # choose the right location dictionary based on the user location type selection 
    if location_type == "bidding-zones":
        location_dict = BIDDING_ZONES
    elif location_type == "countries":
        location_dict = COUNTRIES
    elif location_type == "control-areas":
        location_dict = CONTROL_AREAS
    else:
        return jsonify({"error": "Invalid location type"}), 400

    # handle invalid or missing zones
    if not zone or zone not in location_dict:
        return jsonify({"error": "Invalid or missing zone"}), 400
    
    result = check_date_range(start, end)
    
    start, end = result

    eic_code = location_dict[zone][0]

    series_data = fetch_generation(eic_code, start, end)

    return check_series_data(series_data, "generation", zone)