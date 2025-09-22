from fastapi import FastAPI
from signup import router as signup_router
from login import router as login_router
from student import router as student_router
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:5173"  # if using Vite
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(signup_router)
app.include_router(login_router)
app.include_router(student_router)
