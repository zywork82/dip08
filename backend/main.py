from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Routers
from signup import router as signup_router
from login import router as login_router
from users import router as user_router
from admins import router as admin_router
from analytics import app as analytics_app  
from scenarios import router as scenarios_router



app = FastAPI()

# Allow requests from your frontend
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,   # or ["*"] temporarily
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Routers ---
app.include_router(signup_router)
app.include_router(login_router)
app.include_router(user_router)
app.include_router(admin_router)
app.include_router(scenarios_router)
# app.include_router(scenario_router)  # add when ready

