from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash
from db import db  # use shared async DB connection
from typing import Optional

signup_router = Blueprint("signup_router", __name__, url_prefix="/auth")

@signup_router.route("/signup", methods=["POST"])
def signup():
    data = request.get_json()
    email = data.get("email", "").lower().strip()
    username = data.get("username", "").strip()
    password = data.get("password")
    role = data.get("role", "student")

    existing = db.users.find_one({"email": email})
    if existing:
        return jsonify({"error": "User already exists"}), 400

    hashed_password = generate_password_hash(password)
    new_user = {
    "username": username,
    "email": email,
    "password": hashed_password,
    "role": role,
    }
    result = db.users.insert_one(new_user)
    return jsonify({
    "message": "Signup successful!",
    "user": {
        "id": str(result.inserted_id),
        "username": new_user["username"],
        "email": new_user["email"],
        "role": new_user["role"],
    },
}), 201