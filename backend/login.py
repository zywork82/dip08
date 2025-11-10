from flask import Blueprint, request, jsonify
from werkzeug.security import generate_password_hash, check_password_hash
from jose import jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from bson import ObjectId
from db import db

login_bp = Blueprint("login", __name__, url_prefix="/login")

# --- Password hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- JWT settings (must match admin.py and student.py) ---
SECRET_KEY = "supersecret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# --- Helpers ---
# def verify_password(plain_password: str, hashed_password: str) -> bool:
#     return pwd_context.verify(plain_password, hashed_password)
MAX_PASSWORD_LEN = 72

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    if len(plain_password.encode("utf-8")) > MAX_PASSWORD_LEN:
        print("⚠️ Password too long, rejecting to prevent bcrypt error.")
        return False
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except Exception as e:
        print("⚠️ Password verification error:", e)
        return False

def create_access_token(user_id: str):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# --- Login endpoint ---
@login_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    print("Connected to DB:", db.name)
    email = data.get("email")
    print("Email received:", email)
    password = data.get("password")
    role = data.get("role")
    print("Role received:", role)
    db_user = db["users"].find_one({"email": {"$regex": f"^{email}$", "$options": "i"}})
    print("User found in DB:", db_user)
    if not db_user:
        return jsonify({"error": "Invalid email or password"}), 401
    if not verify_password(password, db_user["password"]):
        return jsonify({"error": "Invalid email or password"}), 401
    if role.lower() != db_user["role"].lower():
        return jsonify({"error": "Incorrect role selected"}), 403

    token = create_access_token(str(db_user["_id"]))
   
    return jsonify({
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user["_id"]),
            "username": db_user["username"],
            "email": db_user["email"],
            "role": db_user["role"],
        },
    }), 200

@login_bp.route("/ping")
def ping():
    return jsonify({"msg": "login backend is running"}), 200
