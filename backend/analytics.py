from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Analytics Engine Backend")

# Allow frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # replace with frontend URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic model
class AnswerAnalytics(BaseModel):
    questionId: str
    selectedOption: str
    timeTaken: int  # seconds

# In-memory storage
analytics_data = []

@app.post("/api/analytics/answer")
async def record_answer(data: AnswerAnalytics):
    entry = {
        "questionId": data.questionId,
        "selectedOption": data.selectedOption,
        "timeTaken_sec": data.timeTaken,
        "timestamp": datetime.utcnow().isoformat()
    }
    analytics_data.append(entry)
    return {"status": "success", "data": entry}

@app.get("/api/analytics/all")
async def get_all_analytics():
    return {"status": "success", "analytics": analytics_data}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
