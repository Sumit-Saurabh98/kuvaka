import { localPrismaClient, Role } from "../../utils/prisma.js";
import { AppError } from "../../utils/errorHandler.js";
import { localRedis } from "../../utils/redis.js";

const CHATROOM_LIST_CACHE_TTL = parseInt(
  process.env.CHATROOM_LIST_CACHE_TTL_SECONDS || "480",
  10
);

// Queue name for messages to Gemini
const GEMINI_QUEUE_NAME = "gemini_message_queue";

export class ChatroomService {
  async createChatroom(userId: string, name: string) {
    // Invalidate cache for this user's chatroom list
    await localRedis.del(`chatrooms:user:${userId}`);

    const chatroom = await localPrismaClient.chatRoom.create({
      data: {
        name,
        userId,
      },
    });
    return chatroom;
  }

  async listChatrooms(userId: string) {
    const cacheKey = `chatrooms:user:${userId}`;

    // Try to get from cache first
    const cachedChatrooms = await localRedis.get(cacheKey);
    if (cachedChatrooms) {
      console.log("Cache hit for chatrooms list!");
      return JSON.parse(cachedChatrooms);
    }

    console.log("Cache miss for chatrooms list. Fetching from DB...");
    const chatrooms = await localPrismaClient.chatRoom.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // Store in cache with a TTL
    await localRedis.setex(
      cacheKey,
      CHATROOM_LIST_CACHE_TTL,
      JSON.stringify(chatrooms)
    );

    return chatrooms;
  }

  async getChatroomDetails(chatroomId: string, userId: string) {
    const chatroom = await localPrismaClient.chatRoom.findUnique({
      where: { id: chatroomId, userId },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });

    if (!chatroom) {
      throw new AppError(
        "Chatroom not found or you do not have access to it.",
        404
      );
    }
    return chatroom;
  }

  async sendMessage(chatroomId: string, userId: string, content: string) {
    // First, verify chatroom ownership
    const chatroom = await localPrismaClient.chatRoom.findUnique({
      where: { id: chatroomId, userId },
    });

    if (!chatroom) {
      throw new AppError(
        "Chatroom not found or you do not have access to it.",
        404
      );
    }

    // Check user's subscription tier for rate limiting *before* sending message
    const user = await localPrismaClient.user.findUnique({
      where: { id: userId },
      include: { subscription: true },
    });

    if (!user) {
      throw new AppError("Authenticated user not found.", 404);
    }

    const activeSubscription = user.subscription.find(
      (sub) => sub.status === "ACTIVE"
    );
    const userTier = activeSubscription?.tier || "BASIC";

    if (userTier === "BASIC") {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize to start of day

      // If lastPromptReset was before today, reset count
      if (
        !user.lastPromptReset ||
        user.lastPromptReset.getTime() < today.getTime()
      ) {
        await localPrismaClient.user.update({
          where: { id: userId },
          data: { dailyPromptCount: 0, lastPromptReset: today }, // Reset to 0 before check
        });
        user.dailyPromptCount = 0; // Update in memory for current check
      }

      const dailyLimit = parseInt(
        process.env.BASIC_TIER_DAILY_PROMPT_LIMIT || "50",
        10
      );
      if (user.dailyPromptCount >= dailyLimit) {
        throw new AppError(
          `Daily prompt limit (${dailyLimit}) reached for Basic tier. Please upgrade to Pro for more usage.`,
          429
        ); // 429 Too Many Requests
      }
    }

    // Save the user's message to the database
    const userMessage = await localPrismaClient.message.create({
      data: {
        chatRoomId: chatroomId,
        role: Role.USER, 
        content,
      },
    });

     // Push message to Redis queue for asynchronous Gemini processing
     const messagePayload = {
      chatroomId: chatroomId,
      userId: userId, // Pass userId for rate limiting in worker
      userMessageId: userMessage.id, // Optional: useful for tracking, though not strictly used by Gemini
      userContent: content,
    };

    await localRedis.lpush(GEMINI_QUEUE_NAME, JSON.stringify(messagePayload));
    console.log(`User message for chatroom ${chatroomId} pushed to queue.`);

    return userMessage;

  }
}
