from fastapi import APIRouter, HTTPException, Depends
from db import db  # MongoDB client from your db.py
from bson import ObjectId
from pydantic import BaseModel
from typing import List, Optional
from fastapi.security import HTTPBearer
from jose import JWTError, jwt
from passlib.hash import bcrypt

router = APIRouter(prefix="/admins", tags=["admins"])
security = HTTPBearer()

# --- JWT settings (must match your login.py) ---
SECRET_KEY = "supersecret"
ALGORITHM = "HS256"

# --- Pydantic Models ---
class AdminUserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "admin"

class AdminUserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

class AdminUserOut(BaseModel):
    id: str
    username: str
    email: str
    role: str

# --- JWT Auth Helper ---
async def get_current_user(token: str = Depends(security)):
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")

        user = await db.users.find_one({"_id": ObjectId(user_id)})
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user["_id"] = str(user["_id"])
        return user

    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

# --- Routes ---

# Get all admin users
@router.get("/users", response_model=List[AdminUserOut])
async def get_admin_users():  # remove current_user: dict = Depends(get_current_user)
    admins_cursor = db.users.find({"role": "admin"})
    admins = []
    async for user in admins_cursor:
        admins.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "role": user.get("role", "admin")
        })
    return admins
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    admins_cursor = db.users.find({"role": "admin"})
    admins = []
    async for user in admins_cursor:
        admins.append({
            "id": str(user["_id"]),
            "username": user["username"],
            "email": user["email"],
            "role": user.get("role", "admin")
        })
    return admins

# Create new admin user
@router.post("/users", response_model=AdminUserOut)
async def create_admin_user(new_user: AdminUserCreate, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    existing = await db.users.find_one({"email": new_user.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    hashed_pw = bcrypt.hash(new_user.password)
    user_data = {
        "username": new_user.username,
        "email": new_user.email,
        "password": hashed_pw,
        "role": new_user.role
    }

    result = await db.users.insert_one(user_data)
    return {
        "id": str(result.inserted_id),
        "username": new_user.username,
        "email": new_user.email,
        "role": new_user.role
    }

# Update admin user
@router.put("/users/{user_id}", response_model=AdminUserOut)
async def update_admin_user(
    user_id: str,
    update_data: AdminUserUpdate,
    current_user: dict = Depends(get_current_user)
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    payload = {k: v for k, v in update_data.dict().items() if v is not None}
    if not payload:
        raise HTTPException(status_code=400, detail="Nothing to update")

    await db.users.update_one({"_id": ObjectId(user_id)}, {"$set": payload})
    user = await db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": str(user["_id"]),
        "username": user["username"],
        "email": user["email"],
        "role": user.get("role", "admin")
    }

# Delete admin user
@router.delete("/users/{user_id}")
async def delete_admin_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await db.users.delete_one({"_id": ObjectId(user_id)})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"msg": "Admin user deleted successfully"}
