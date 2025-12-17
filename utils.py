from datetime import timedelta
from typing import Any, Dict, List, Tuple, Optional
import pandas as pd
from flask import jsonify
from constants import DEFAULT_TZ, MAX_DATE_RANGE


def date_range(start: str, end: str) -> Tuple[pd.Timestamp, pd.Timestamp]:
    """
    From inputs "start" and "end" (YYYY-MM-DD) convert into pandas Timestamp object,
    since ENTSO-e Python client functions use it as input for start and end dates.
    """
    if not start or not end:
        raise ValueError("Start and end date are required")
    
    start = pd.Timestamp(start).tz_localize(DEFAULT_TZ)
    end = pd.Timestamp(end).tz_localize(DEFAULT_TZ) + timedelta(days=1) # include end date

    if end <= start:
        raise ValueError("End date must be after start date")

    # end - start is timedelta object which uses atribute days
    if (end - start).days > MAX_DATE_RANGE:
        raise ValueError(f"Date range cannot exceed {MAX_DATE_RANGE} days")

    return start, end


def check_date_range(start: pd.Timestamp, end: pd.Timestamp):
    """
    Return error meesage if date range is invalid.
    """
    try:
        start, end = date_range(start, end)
        return start, end
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    

def check_series_data(series_data: Optional[List[Dict[str, Any]]], data_type: str, zone: str):
    """
    Return warning message if series_data is None.
    """
    if data_type == "prices":
        if series_data is None:
            # Return empty data with warning message
            return jsonify({
                "data": {"series": [], "unit": "EUR/MWh"},
                "warning": f"No market price data available for {zone} in the selected date range."
            })
        response = {"series": series_data, "unit": "EUR/MWh"}
        return jsonify(
        {"data": response, "zone": zone}
    )
    elif data_type == "generation":
        if series_data is None:
        # Return empty data with warning message
            return jsonify({
                "data": {"series": {}, "unit": "MW"},
                "warning": f"No generation per type data available for {zone} in the selected date range."
            })
        response = {"series": series_data, "unit": "MW"}
        return jsonify(
        {"data": response, "zone": zone}
    )
    else:
        return jsonify({"error": "Invalid data type"}), 400
    

def series_to_response(series: pd.Series) -> List[Dict[str, Any]]:
    """
    Create a list of dictionaries with two key, value pairs. Pair example:
    "timestamp": "2025-12-06T00:00:00+01:00" and "value": 96.7.
    """
    # series = series.tz_convert(DEFAULT_TZ).dropna()
    series = series.dropna()
    return [
        {"timestamp": timestamp.isoformat(), "value": float(price)}
        for timestamp, price in series.items()]


def frame_to_response(data_frame: pd.DataFrame) -> Dict[str, List[Dict[str, Any]]]:
    """Convert a DataFrame to mapping of column -> list of timestamp/value."""
    """
    Create a dictionary of key value pairs where every key represents psr_type and values 
    is a list of dictionaries with timestamp and generation value pairs.
    """
    frame = data_frame.tz_convert(DEFAULT_TZ).fillna(0)
    response: Dict[str, List[Dict[str, Any]]] = {}

    # dataframe columns can sometimes be of a type multiIndex. 
    # In that case keep only columns with "Actual Generation" on second index.
    if isinstance(frame.columns, pd.MultiIndex):
        mask = frame.columns.get_level_values(1) != "Actual Consumption"
        frame = frame.loc[:, mask].copy()
        frame.columns = frame.columns.droplevel(1)
    
    # for every psr_type fetch pairs -> timestamp : generation
    for psr_type in frame.columns:
        response[psr_type] = [
            {"timestamp": timestamp.isoformat(), "value": float(generation)}
            for timestamp, generation in frame[psr_type].items()
        ]
    return response


def cache_key(zone: str, start: pd.Timestamp, end: pd.Timestamp, data_type: str) -> str:
    """
    Create a unique cache key based on user input. Key consists of zone, 
    start date, end date and data type (generation per type or market price).
    """
    return f"{zone}:{start.isoformat()}:{end.isoformat()}:{data_type}"