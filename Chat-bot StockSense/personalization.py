"""MongoDB hook for user-specific portfolio and prediction context."""

from __future__ import annotations

import os
from typing import Dict, Optional

from pymongo import MongoClient


# Expected sample schema (flexible):
# users collection
# {
#   "user_id": "u123",
#   "stocks": [{"symbol": "ABC", "qty": 100, "avg_buy": 45.2}],
#   "predictions": [{"symbol": "ABC", "horizon": "3m", "outlook": "bullish"}]
# }


def load_user_profile(user_id: Optional[str]) -> Optional[Dict[str, object]]:
    if not user_id:
        return None

    mongo_uri = os.getenv("MONGO_URI")
    db_name = os.getenv("MONGO_DB_NAME", "stocksense")
    users_collection = os.getenv("MONGO_USERS_COLLECTION", "users")

    if not mongo_uri:
        return {
            "user_id": user_id,
            "note": "MONGO_URI not configured. Returning placeholder profile.",
            "stocks": [],
            "predictions": [],
        }

    client = MongoClient(mongo_uri)
    db = client[db_name]
    record = db[users_collection].find_one({"user_id": user_id})

    if not record:
        return {
            "user_id": user_id,
            "note": "No record found in MongoDB for this user.",
            "stocks": [],
            "predictions": [],
        }

    return {
        "user_id": record.get("user_id"),
        "stocks": record.get("stocks", []),
        "predictions": record.get("predictions", []),
    }
