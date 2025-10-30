from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware
from db import db  

app = FastAPI(title="Analytics Engine Backend")

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with your frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Define request model
class AnswerAnalytics(BaseModel):
    username: str
    scenario_id: str
    node_id: str
    selected_option: str
    time_taken: float
    is_correct: bool

@app.post("/api/analytics/answer")
async def record_answer(data: AnswerAnalytics):
    """Save analytics record to MongoDB"""
    entry = {
        "username": data.username,
        "scenario_id": data.scenario_id,
        "node_id": data.node_id,
        "selected_option": data.selected_option,
        "time_taken": data.time_taken,
        "is_correct": data.is_correct,
        "ts": datetime.utcnow().isoformat()
    }

    result = await db["reports"].insert_one(entry)
    if not result.inserted_id:
        raise HTTPException(status_code=500, detail="Failed to insert analytics data")

    return {"status": "success", "data": entry}

@app.get("/api/analytics/all")
async def get_all_analytics():
    """Retrieve all analytics records"""
    cursor = db["reports"].find({}, {"_id": 0})  # exclude _id field
    analytics = await cursor.to_list(length=None)
    return {"status": "success", "analytics": analytics}

class PlaythroughAnalytics(BaseModel):
    username: str
    scenario_id: str
    choices: list  # list of {node_id, selected_option, time_taken, is_correct}

@app.post("/api/analytics/playthrough")
async def record_playthrough(data: PlaythroughAnalytics):
    entry = {
        "username": data.username,
        "scenario_id": data.scenario_id,
        "choices": data.choices,
        "ts": datetime.utcnow().isoformat()
    }
    result = await db["reports"].insert_one(entry)
    if not result.inserted_id:
        raise HTTPException(status_code=500, detail="Failed to insert playthrough")
    return {"status": "success", "data": entry}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
