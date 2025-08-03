import "dotenv/config"
import Redis from "ioredis"

export const localRedis = new Redis(`${process.env.REDIS_URL}`);

localRedis.on("connect", () => {
    console.log("Connected to Redis");
});