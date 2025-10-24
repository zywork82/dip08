from flask import Blueprint, request, jsonify
from jose import jwt, JWTError
from bson import ObjectId
from datetime import datetime, timedelta
from db import db  # same as before

users_bp = Blueprint("users", __name__, url_prefix="/users")

# --- JWT Settings ---
SECRET_KEY = "supersecret"
ALGORITHM = "HS256"


# --- Helper: Get current user ---
def get_current_user():
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None, jsonify({"error": "Missing or invalid token"}), 401

    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None, jsonify({"error": "Invalid token"}), 401

        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return None, jsonify({"error": "User not found"}), 404

        user["_id"] = str(user["_id"])
        return user, None, None

    except JWTError:
        return None, jsonify({"error": "Invalid or expired token"}), 401


# --- Get current profile ---
@users_bp.route("/me", methods=["GET"])
def get_me():
    current_user, err, status = get_current_user()
    if err:
        return err, status

    return jsonify({
        "id": current_user["_id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "role": current_user.get("role", "student")
    })


# --- Update profile ---
@users_bp.route("/me", methods=["PUT"])
def update_me():
    current_user, err, status = get_current_user()
    if err:
        return err, status

    data = request.get_json()
    allowed = {"username"}
    payload = {k: v for k, v in data.items() if k in allowed}

    if not payload:
        return jsonify({"error": "Nothing to update"}), 400

    db.users.update_one({"_id": ObjectId(current_user["_id"])}, {"$set": payload})
    return jsonify({"msg": "Profile updated"}), 200


# --- Log analytics event ---
@users_bp.route("/me/events", methods=["POST"])
def log_event():
    current_user, err, status = get_current_user()
    if err:
        return err, status

    data = request.get_json()
    event_doc = {
        "user_id": ObjectId(current_user["_id"]),
        "event_type": data.get("event_type"),
        "duration": float(data.get("duration", 0)),
        "metadata": data.get("metadata", {}),
        "ts": datetime.utcnow(),
    }
    db.events.insert_one(event_doc)
    return jsonify({"msg": "Event logged"}), 201


# --- Analytics summary ---
@users_bp.route("/me/analytics", methods=["GET"])
def analytics():
    current_user, err, status = get_current_user()
    if err:
        return err, status

    uid = ObjectId(current_user["_id"])
    total = db.events.count_documents({"user_id": uid})

    pipeline = [
        {"$match": {"user_id": uid}},
        {
            "$group": {
                "_id": "$event_type",
                "count": {"$sum": 1},
                "avg_duration": {"$avg": "$duration"},
            }
        },
    ]
    by_type = list(db.events.aggregate(pipeline))

    since = datetime.utcnow() - timedelta(days=7)
    pipeline2 = [
        {"$match": {"user_id": uid, "ts": {"$gte": since}}},
        {
            "$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}},
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    daily = list(db.events.aggregate(pipeline2))

    return jsonify({
        "total_events": total,
        "by_type": by_type,
        "daily_last_7_days": daily,
    })


# --- Get all users (optional role filter) ---
@users_bp.route("/", methods=["GET"])
def list_users():
    current_user, err, status = get_current_user()
    if err:
        return err, status

    role = request.args.get("role")
    query = {}
    if role:
        query["role"] = {"$regex": f"^{role}$", "$options": "i"}

    users = list(db.users.find(query))
    normalized_users = []

    for u in users:
        u["_id"] = str(u["_id"])
        if u.get("role", "").lower() == "admin":
            u["role"] = "Administrator"
        normalized_users.append(u)

    return jsonify(normalized_users), 200
