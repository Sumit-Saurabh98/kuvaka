import "dotenv/config"
import Redis from "ioredis"

// --- Connect to Redis ---
export const localRedis = new Redis(`${process.env.REDIS_URL}`);

localRedis.on("connect", () => {
    console.log("Connected to Redis");
});