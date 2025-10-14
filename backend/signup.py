from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from db import db  # use shared async DB connection
from typing import Optional

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class SignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Optional[str] = "student"  # default to student

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

@router.post("/signup")
async def signup(user: SignupRequest):
    # Normalize email to lowercase
    email = user.email.lower().strip()

    # Check for duplicates
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="User already exists")

    # Hash password and insert
    hashed_password = hash_password(user.password)
    new_user = {
        "username": user.username.strip(),
        "email": email,
        "password": hashed_password,
        "role": user.role or "student",
    }

    result = await db.users.insert_one(new_user)
    return {
        "message": "Signup successful!",
        "user": {
            "id": str(result.inserted_id),
            "username": new_user["username"],
            "email": new_user["email"],
            "role": new_user["role"],
        },
    }
