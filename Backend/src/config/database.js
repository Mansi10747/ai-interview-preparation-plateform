const mongoose = require("mongoose");
let mongodInstance = null;

async function connectToDB() {
    if (process.env.MONGO_URI) {
        try {
            console.log("[Database] Connecting to configured MONGO_URI...");
            await mongoose.connect(process.env.MONGO_URI, {
                serverSelectionTimeoutMS: 3000,
            });
            console.log("[Database] Successfully connected to configured MongoDB!");
            return;
        } catch (err) {
            console.warn("[Database] Could not connect to configured MONGO_URI:", err.message);
            console.log("[Database] Falling back to In-Memory MongoDB server for this session...");
        }
    }

    try {
        const { MongoMemoryServer } = require("mongodb-memory-server");
        mongodInstance = await MongoMemoryServer.create();
        const fallbackUri = mongodInstance.getUri();
        await mongoose.connect(fallbackUri);
        console.log("[Database] Successfully connected to In-Memory MongoDB at:", fallbackUri);
    } catch (fallbackErr) {
        console.error("[Database] Failed to initialize in-memory database:", fallbackErr);
    }
}

module.exports = connectToDB;