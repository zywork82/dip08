from flask import Blueprint, request, jsonify
from db import db  # this should be your PyMongo db object
from datetime import datetime

analytics_bp = Blueprint("analytics", __name__)

# Save analytics/report to MongoDB
@analytics_bp.route("/api/analytics/save", methods=["POST"])
def save_analytics():
    data = request.get_json()
    if not data:
        return jsonify({"error": "No data provided"}), 400

    record = {
        "user_id": data.get("user_id"),
        "scenario_id": data.get("scenario_id"),
        "score": data.get("score"),
        "choices": data.get("choices", []),
        "time_taken": data.get("time_taken"),
        "created_at": datetime.utcnow(),
    }

    db.analytics.insert_one(record)  # MongoDB collection insert
    return jsonify({"message": "Analytics saved successfully"}), 201


# Get all analytics for a user
@analytics_bp.route("/api/analytics/<user_id>", methods=["GET"])
def get_user_analytics(user_id):
    records = list(db.analytics.find({"user_id": user_id}, {"_id": 0}))
    return jsonify(records), 200