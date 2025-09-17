from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from pymongo import MongoClient
from jose import jwt
from datetime import datetime, timedelta

# --- Database ---
client = MongoClient("***REMOVED***chloeechuajy:1234@cluster0.nr5hh1l.mongodb.net/")
db = client["dip"]
users = db["users"]

# --- Password hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- Router ---
router = APIRouter()

# --- JWT settings ---
SECRET_KEY = "supersecret"  # must match student.py
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

# --- Request model ---
class LoginRequest(BaseModel):
    email: EmailStr
    password: str

# --- Helpers ---
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(user_id: str):
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": user_id, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# --- Login endpoint ---
@router.post("/login")
def login(user: LoginRequest):
    db_user = users.find_one({"email": user.email})
    if not db_user or not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token(str(db_user["_id"]))  # important: convert ObjectId to string

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(db_user["_id"]),
            "username": db_user["username"],
            "email": db_user["email"],
            "role": db_user["role"]
        }
    }
