const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server-core");

let memoryServer = null;

const connectDb = async () => {
  const mongoUri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/team_task_manager";

  try {
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected");
  } catch (error) {
    if (process.env.NODE_ENV === "production") {
      throw error;
    }

    console.warn("Primary MongoDB unavailable. Falling back to in-memory MongoDB for local development.");
    memoryServer = await MongoMemoryServer.create();
    const memoryUri = memoryServer.getUri();
    await mongoose.connect(memoryUri);
    console.log("In-memory MongoDB connected");
  }
};

module.exports = connectDb;
