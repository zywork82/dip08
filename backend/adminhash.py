import asyncio
from passlib.context import CryptContext
from motor.motor_asyncio import AsyncIOMotorClient

# --- MongoDB connection ---
MONGO_URI = "mongodb+srv://chloeechuajy:1234@cluster0.nr5hh1l.mongodb.net/"
client = AsyncIOMotorClient(MONGO_URI)
db = client["dip"]  # replace with your DB name

# --- Password hashing ---
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# --- The new password you want to set for all admins ---
NEW_ADMIN_PASSWORD = "Admin123!"  # choose a secure password

async def hash_admin_passwords():
    admins = db.users.find({"role": "admin"})
    async for admin in admins:
        hashed = pwd_context.hash(NEW_ADMIN_PASSWORD)
        await db.users.update_one(
            {"_id": admin["_id"]},
            {"$set": {"password": hashed}}
        )
        print(f"Updated admin {admin['email']}")

    print("All admin passwords updated successfully!")

if __name__ == "__main__":
    asyncio.run(hash_admin_passwords())
