import os
from dotenv import load_dotenv

load_dotenv()

ENTSOE_API_KEY = os.getenv("ENTSOE_API_KEY") or os.getenv("ENTSOE_TOKEN")

if not ENTSOE_API_KEY:
    raise RuntimeError("Missing ENTSOE_API_KEY or ENTSOE_TOKEN in environment")