from flask import Flask
from flask_cors import CORS

# Blueprints
from signup import signup_router
from login import login_bp
from users import users_bp
from admins import admin_bp
from scenarios import scenarios_bp

app = Flask(__name__)

# Enable CORS for React frontend, allow Authorization header
CORS(app, origins=["http://localhost:3000"])

# Register Blueprints
app.register_blueprint(signup_router)
app.register_blueprint(login_bp)
app.register_blueprint(users_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(scenarios_bp)

if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
