import "dotenv/config";
import {
  localPrismaClient,
  Role,
  SubscriptionStatus,
  SubscriptionTier,
} from "./prisma.js";
import { localRedis } from "./redis.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Instantiate Gemini model
const model = new GoogleGenerativeAI(
  process.env.GOOGLE_GEMINI_API_KEY!
).getGenerativeModel({ model: "gemini-2.5-pro" });

// Arbitrary queue name
const GEMINI_QUEUE_NAME = "gemini_message_queue";
let isShuttingDown = false;

// ---- processTask: process one message from Redis ----
async function processTask(payload: string) {
  // Define payload shape for clarity
  type MessagePayload = {
    chatroomId: string;
    userId: string;
    userMessageId: string;
    userContent: string;
  };

  // Parse the JSON from the queue
  const { chatroomId, userId, userContent } = JSON.parse(
    payload
  ) as MessagePayload;

  // Load current chat history from Prisma
  const chatHistory = await localPrismaClient.message.findMany({
    where: { chatRoomId: chatroomId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  // Build the formatted history Gemini expects
  const historyForGemini = chatHistory.map((msg) => ({
    role: msg.role === Role.USER ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  // Start a chat session and send the user's new message
  const chat = model.startChat({
    history: historyForGemini,
    generationConfig: { maxOutputTokens: 2000 },
  });
  const geminiResult = await chat.sendMessage(userContent);
  const geminiText = geminiResult.response.text();

  // Persist both the model’s response and user’s prompt-count in a DB transaction
  await localPrismaClient.$transaction(async (tx) => {
    await tx.message.create({
      data: {
        chatRoomId: chatroomId,
        role: Role.GEMINI,
        content: geminiText,
      },
    });

    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });
    if (!user) return;

    // check if user is a basic user
    const sub = user.subscription;
    const isBasicUser =
      sub?.status === SubscriptionStatus.ACTIVE &&
      sub?.tier === SubscriptionTier.BASIC;

    if (!isBasicUser) return;

    // gives current date and time
    const now = new Date();

    //This creates a new Date object representing midnight today in UTC time.
    const todayUTC = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    );

    // if user has never used the prompts before or the last time they used a prompt was before today (UTC), so it's a new day, and we should reset the counter.
    const shouldReset =
      !user.lastPromptReset ||
      user.lastPromptReset.getTime() < todayUTC.getTime();

    // update the user's prompt count
    await tx.user.update({
      where: { id: userId },
      data: shouldReset
        ? { dailyPromptCount: 1, lastPromptReset: todayUTC }
        : { dailyPromptCount: { increment: 1 } },
    });
  });
}

// ---- workerLoop: continuously drain and process the queue ----
async function workerLoop() {
  console.log("Gemini AI Worker started…");
  while (!isShuttingDown) {
    try {
      const res = await localRedis.brpop(GEMINI_QUEUE_NAME, 0);
      if (!res) continue;
      // [queueName, payload]
      const payload = res[1];
      await processTask(payload);
    } catch (err: any) {
      console.error("Worker encountered an error:", err);
      await new Promise((r) => setTimeout(r, 1000)); // retry after 1 second
    }
  }

  console.log("Worker shutting down…");
  await localPrismaClient.$disconnect();
  await localRedis.quit();
  console.log("Disconnected Prisma & Redis. Worker exited.");
}

// ---- Graceful shutdown on process signals ----
process.on("SIGINT", () => {
  console.log("Received SIGINT. Will exit after current task…");
  isShuttingDown = true;
});
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Will exit after current task…");
  isShuttingDown = true;
});

workerLoop();
