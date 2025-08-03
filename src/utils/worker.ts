import "dotenv/config";
import { localPrismaClient, Role, SubscriptionStatus } from "./prisma.js";
import { localRedis } from "./redis.js";
import { GoogleGenerativeAI } from "@google/generative-ai";

const model = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY!)
  .getGenerativeModel({ model: "gemini-2.5-pro" });

const GEMINI_QUEUE_NAME = "gemini_message_queue";
let isShuttingDown = false;

async function processTask(payload: string) {
  type MessagePayload = {
    chatroomId: string;
    userId: string;
    userMessageId: string;
    userContent: string;
  };
  const { chatroomId, userId, userMessageId, userContent } = JSON.parse(payload) as MessagePayload;

  const chatHistory = await localPrismaClient.message.findMany({
    where: { chatRoomId: chatroomId },
    orderBy: { createdAt: "asc" },
    select: { role: true, content: true },
  });

  const historyForGemini = chatHistory.map((msg) => ({
    role: msg.role === Role.USER ? "user" : "model",
    parts: [{ text: msg.content }],
  }));

  const chat = model.startChat({ history: historyForGemini, generationConfig: { maxOutputTokens: 2000 } });
  const geminiResult = await chat.sendMessage(userContent);
  const geminiText = await geminiResult.response.text();

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

    const isBasicUser = user.subscription.some((sub) => sub.status === SubscriptionStatus.ACTIVE && sub.tier === "BASIC");
    if (!isBasicUser) return;

    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    const shouldReset = !user.lastPromptReset || user.lastPromptReset.getTime() < todayUTC.getTime();

    await tx.user.update({
      where: { id: userId },
      data: shouldReset
        ? { dailyPromptCount: 1, lastPromptReset: todayUTC }
        : { dailyPromptCount: { increment: 1 } },
    });
  });
}

async function workerLoop() {
  console.log("Gemini AI Worker started…");
  while (!isShuttingDown) {
    try {
      const res = await localRedis.brpop(GEMINI_QUEUE_NAME, 0);
      if (!res) continue;
      const payload = res[1];
      await processTask(payload);
    } catch (err: any) {
      console.error("Worker encountered an error:", err);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  console.log("Worker shutting down…");
  await localPrismaClient.$disconnect();
  await localRedis.quit();
  console.log("Disconnected Prisma & Redis. Worker exited.");
}

process.on("SIGINT", () => {
  console.log("Received SIGINT. Will exit after current task…");
  isShuttingDown = true;
});
process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Will exit after current task…");
  isShuttingDown = true;
});

workerLoop();
