from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from jose import JWTError, jwt
from bson import ObjectId
from datetime import datetime, timedelta
from db import db

admin_bp = Blueprint("admins", __name__, url_prefix="/admins")

# --- JWT settings (must match your login.py) ---
SECRET_KEY = "supersecret"
ALGORITHM = "HS256"

def get_current_user(request):
    if "Authorization" not in request.headers:
        return None, (jsonify({"error": "Missing token"}), 401)

    token = request.headers["Authorization"].split(" ")[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            return None, (jsonify({"error": "Invalid token"}), 401)

        user = db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            return None, (jsonify({"error": "User not found"}), 404)

        user["_id"] = str(user["_id"])
        return user, None
    except JWTError:
        return None, (jsonify({"error": "Invalid or expired token"}), 401)


def get_initials(name: str) -> str:
    """Return uppercase initials from a name"""
    if not name:
        return "U"  # default if no name
    parts = name.strip().split()
    if len(parts) == 1:
        return parts[0][0].upper()
    return (parts[0][0] + parts[-1][0]).upper()

def generate_profile_placeholder(name: str) -> str:
    initials = get_initials(name)
    return f"https://placehold.co/100x100/E6E6FA/3f51b5?text={initials}"

# --- Routes ---

@admin_bp.route("/users", methods=["GET"])
def get_admin_users():
    admins = list(db.users.find({"role": "admin"}))
    output = []
    for user in admins:
        output.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "role": user.get("role", "admin"),
            "profileImage": user.get("profileImage") or generate_profile_placeholder(user["username"])
        })
    return jsonify(output), 200

# Create new admin user
@admin_bp.route("/users", methods=["POST"])
def create_admin_user():
    data = request.get_json()
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")
    role = data.get("role", "admin")

    existing = db.users.find_one({"email": email})
    if existing:
        return jsonify({"error": "Email already exists"}), 400

    hashed_pw = generate_password_hash(password)
    user_data = {
        "username": username,
        "email": email,
        "password": hashed_pw,
        "role": role
    }
    result = db.users.insert_one(user_data)

    return jsonify({
        "id": str(result.inserted_id),
        "username": username,
        "email": email,
        "role": role
    }), 201


@admin_bp.route("/users/<user_id>", methods=["PUT"])
def update_admin_user(user_id):
    current_user, error = get_current_user(request)
    if error:
        return error
    if current_user.get("role") != "admin":
        return jsonify({"error": "Not authorized"}), 403

    data = request.get_json()
    payload = {k: v for k, v in data.items() if v is not None}
    if not payload:
        return jsonify({"error": "Nothing to update"}), 400

    db.users.update_one({"_id": ObjectId(user_id)}, {"$set": payload})
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user.get("role", "admin")
    }), 200

@admin_bp.route("/users/<user_id>", methods=["DELETE"])
def delete_admin_user(user_id):
    current_user, error = get_current_user(request)
    if error:
        return error
    if current_user.get("role") != "admin":
        return jsonify({"error": "Not authorized"}), 403

    result = db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        return jsonify({"error": "User not found"}), 404

    return jsonify({"msg": "Admin user deleted successfully"}), 200