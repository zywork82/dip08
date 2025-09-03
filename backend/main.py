from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from passlib.context import CryptContext

client = MongoClient("mongodb+srv://chloeechuajy:1234@cluster0.nr5hh1l.mongodb.net/")
db = client["dip"]
users = db["users"]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto") #password hashing


class SignupRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


app = FastAPI()

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

@app.post("/signup")
def signup(user: SignupRequest):
    # Check if user already exists
    if users.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="User already exists")

    # Always assign student role (admins cannot sign up here)
    hashed_password = get_password_hash(user.password)
    new_user = {
        "username": user.username,
        "email": user.email,
        "password": hashed_password,
        "role": "student"   # force role to student
    }
    users.insert_one(new_user)

    return {"message": "Signup successful! You are registered as a student."}


@app.post("/login")
def login(user: LoginRequest):
    db_user = users.find_one({"email": user.email})
    if not db_user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not verify_password(user.password, db_user["password"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    # Return the role from database (student/admin)
    return {
    "message": "Login successful",
    "username": db_user["username"],
    "email": db_user["email"],
    "role": db_user["role"]
    }