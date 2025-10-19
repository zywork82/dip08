# from motor.motor_asyncio import AsyncIOMotorClient
# import os

# MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://chloeechuajy:1234@cluster0.nr5hh1l.mongodb.net/")
# client = AsyncIOMotorClient(MONGO_URI)
# db = client["dip"]  # your database name

# db.py
from pymongo import MongoClient
import os

MONGO_URI = os.getenv("MONGO_URI", "mongodb+srv://chloeechuajy:1234@cluster0.nr5hh1l.mongodb.net/")
client = MongoClient(MONGO_URI)
db = client["dip"]  # your database name
