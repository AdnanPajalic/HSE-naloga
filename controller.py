from typing import Any, Dict, List, Optional
import pandas as pd
from entsoe import EntsoePandasClient
from entsoe.exceptions import NoMatchingDataError
from utils import frame_to_response, series_to_response, cache_key
from config import ENTSOE_API_KEY

# https://github.com/EnergieID/entsoe-py?tab=readme-ov-file Python client for ENTSO-E API!

client = EntsoePandasClient(api_key=ENTSOE_API_KEY)
cache: Dict[str, Any] = {}


def fetch_prices(zone: str, start: pd.Timestamp, end: pd.Timestamp) -> Optional[List[Dict[str, Any]]]:
    """
    Fetch market prices for given a location, start and end date. If the data for given location or 
    given time period does not exist, return NoMatchingDataError from entsoe library.
    """
    key = cache_key(zone, start, end, "prices")
    # cache_key already in cache dictionary. Save response so we dont have to call the api again.
    # when user refreshes page, cache dictionary becomes empty.
    if key in cache:
        return cache[key]
    
    # use function to get market prices
    try:
        series = client.query_day_ahead_prices(zone, start=start, end=end)
        response = series_to_response(series)
        cache[key] = response
        return response
    
    except NoMatchingDataError:
        cache[key] = None
        return None


def fetch_generation(zone: str, start: pd.Timestamp, end: pd.Timestamp) -> Optional[Dict[str, List[Dict[str, Any]]]]:
    # same logic as in fetch_prices
    key = cache_key(zone, start, end, "generation")
    if key in cache:
        return cache[key]

    # use function to get generation values for every psr_type
    try:
        frame = client.query_generation(zone, start=start, end=end, psr_type=None)
        payload = frame_to_response(frame)
        cache[key] = payload
        return payload
    except NoMatchingDataError:
        cache[key] = None
        return None