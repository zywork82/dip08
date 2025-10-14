from fastapi import APIRouter, Depends, HTTPException
from db import db
from bson import ObjectId
from typing import Optional
from datetime import datetime, timedelta
from jose import JWTError, jwt
from fastapi.security import HTTPBearer

router = APIRouter(prefix="/users", tags=["users"])
security = HTTPBearer()

# --- JWT settings ---
SECRET_KEY = "supersecret"  # must match login.py
ALGORITHM = "HS256"


# --- Helper: get current user ---
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
        raise HTTPException(status_code=401, detail="Invalid token")


# --- Get current profile ---
@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "id": current_user["_id"],
        "username": current_user["username"],
        "email": current_user["email"],
        "role": current_user.get("role", "student"),
    }


# --- Update profile ---
@router.put("/me")
async def update_me(update_data: dict, current_user: dict = Depends(get_current_user)):
    allowed = {"username"}  # only allow updating username
    payload = {k: v for k, v in update_data.items() if k in allowed}
    if not payload:
        raise HTTPException(status_code=400, detail="Nothing to update")
    await db.users.update_one(
        {"_id": ObjectId(current_user["_id"])}, {"$set": payload}
    )
    return {"msg": "Profile updated"}


# --- Log analytics event ---
@router.post("/me/events")
async def log_event(event: dict, current_user: dict = Depends(get_current_user)):
    event_doc = {
        "user_id": ObjectId(current_user["_id"]),
        "event_type": event.get("event_type"),
        "duration": float(event.get("duration", 0)),
        "metadata": event.get("metadata", {}),
        "ts": datetime.utcnow(),
    }
    await db.events.insert_one(event_doc)
    return {"msg": "Event logged"}


# --- Analytics summary ---
@router.get("/me/analytics")
async def analytics(current_user: dict = Depends(get_current_user)):
    uid = ObjectId(current_user["_id"])
    total = await db.events.count_documents({"user_id": uid})

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
    by_type = await db.events.aggregate(pipeline).to_list(length=None)

    since = datetime.utcnow() - timedelta(days=7)
    pipeline2 = [
        {"$match": {"user_id": uid, "ts": {"$gte": since}}},
        {
            "$group": {
                "_id": {
                    "$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}
                },
                "count": {"$sum": 1},
            }
        },
        {"$sort": {"_id": 1}},
    ]
    daily = await db.events.aggregate(pipeline2).to_list(length=None)

    return {
        "total_events": total,
        "by_type": by_type,
        "daily_last_7_days": daily,
    }


# --- Get all users (optionally filter by role) ---
@router.get("/")
async def list_users(
    role: Optional[str] = None, current_user: dict = Depends(get_current_user)
):
    query = {}
    if role:
        query["role"] = {"$regex": f"^{role}$", "$options": "i"}  # case-insensitive

    users = await db.users.find(query).to_list(100)

    normalized_users = []
    for u in users:
        u["_id"] = str(u["_id"])
        # normalize role so frontend always sees "Administrator"
        if u.get("role", "").lower() == "admin":
            u["role"] = "Administrator"
        normalized_users.append(u)

    return normalized_users
