# app.py
from flask import Flask
from flask_cors import CORS

# Blueprints (instead of FastAPI routers)
from signup import signup_router
from login import login_router
from users import user_router
from admins import admin_router
from analytics import analytics_app
from scenarios import scenarios_router
from flow_routes import flow_router

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000", "http://127.0.0.1:3000"], supports_credentials=True)

# --- Register blueprints ---
app.register_blueprint(signup_router)
app.register_blueprint(login_router)
app.register_blueprint(user_router)
app.register_blueprint(admin_router)
app.register_blueprint(scenarios_router)
app.register_blueprint(flow_router)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=8000, debug=True)
