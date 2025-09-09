from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from pymongo import MongoClient

client = MongoClient("mongodb+srv://chloeechuajy:1234@cluster0.nr5hh1l.mongodb.net/")
db = client["dip"]
users = db["users"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
router = APIRouter()

class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str


def hash_password(password: str) -> str:
    return pwd_context.hash(password)

@router.post("/signup")
def signup(user: SignupRequest):
    if users.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="User already exists")

    hashed_password = hash_password(user.password)
    new_user = {
        "username": user.username,
        "email": user.email,
        "password": hashed_password,
        "role": "student"  # force role to student
    }
    users.insert_one(new_user)
    return {"message": "Signup successful! You are registered as a student."}