from flask import Blueprint, request, jsonify
from db import db
from datetime import datetime
from bson import ObjectId

analytics_bp = Blueprint("analytics", __name__)

# -----------------------------
# Save analytics/report to MongoDB
# -----------------------------
@analytics_bp.route("/api/analytics/save", methods=["POST"])
def save_analytics():
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "No data provided"}), 400

        user_id = data.get("user_id")
        scenario_id = data.get("scenario_id")

        if not user_id or not scenario_id:
            return jsonify({"error": "Missing user_id or scenario_id"}), 400

        record = {
            "user_id": user_id,
            "scenario_id": scenario_id,
            "score": data.get("score"),
            "choices": data.get("choices", []),
            "time_taken": data.get("time_taken"),
            "created_at": datetime.utcnow(),
        }

        db.analytics.insert_one(record)
        return jsonify({"message": "Analytics saved successfully"}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Get all analytics for a user
# -----------------------------
@analytics_bp.route("/api/analytics/<user_id>", methods=["GET"])
def get_user_analytics(user_id):
    try:
        # Optionally filter by scenario_id if passed as a query param
        scenario_id = request.args.get("scenario_id")
        query = {"user_id": user_id}
        if scenario_id:
            query["scenario_id"] = scenario_id

        records = list(db.analytics.find(query))
        for r in records:
            r["_id"] = str(r["_id"])
            # convert ObjectId to string if scenario_id stored as ObjectId
            if isinstance(r.get("scenario_id"), ObjectId):
                r["scenario_id"] = str(r["scenario_id"])
            if isinstance(r.get("user_id"), ObjectId):
                r["user_id"] = str(r["user_id"])

        return jsonify(records), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500

@analytics_bp.route("/api/analytics", methods=["GET"])
def get_all_analytics():
    try:
        records = list(db.analytics.find({}))
        for r in records:
            r["_id"] = str(r["_id"])
            if isinstance(r.get("scenario_id"), ObjectId):
                r["scenario_id"] = str(r["scenario_id"])
            if isinstance(r.get("user_id"), ObjectId):
                r["user_id"] = str(r["user_id"])
        return jsonify(records), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# -----------------------------
# Optional: Delete a user's analytics (for cleanup/testing)
# -----------------------------
@analytics_bp.route("/api/analytics/<user_id>", methods=["DELETE"])
def delete_user_analytics(user_id):
    try:
        result = db.analytics.delete_many({"user_id": user_id})
        return jsonify({"message": f"Deleted {result.deleted_count} analytics records"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500