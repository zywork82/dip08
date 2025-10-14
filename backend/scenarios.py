from fastapi import APIRouter
from db import db

router = APIRouter(prefix="/scenarios", tags=["scenarios"])

@router.get("/")
async def get_all_scenarios():
    scenarios = await db.scenarios.find().to_list(length=100)
    for s in scenarios:
        s["_id"] = str(s["_id"])
    return scenarios
