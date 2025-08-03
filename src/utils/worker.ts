import "dotenv/config";
import { localPrismaClient, Role, SubscriptionStatus } from "./prisma.js";
import { localRedis } from "./redis.js";
import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

const GOOGLE_GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY;

if (!GOOGLE_GEMINI_API_KEY) {
  console.error(
    "ERROR: GOOGLE_GEMINI_API_KEY is not set in environment variables."
  );
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(GOOGLE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// Queue name for messages to Gemini
const GEMINI_QUEUE_NAME = 'gemini_message_queue';


console.log('Gemini AI Worker started. Listening for messages...');

async function processQueue() {
    try {

      // Blocking pop from the queue. Waits until a message is available. 0 means wait indefinitely
      const result = await localRedis.brpop(GEMINI_QUEUE_NAME, 0);
  
      if (result) {
        const [, messageString] = result;

        const { chatroomId, userId, userMessageId, userContent } = JSON.parse(messageString);
  
        const chatHistory = await localPrismaClient.message.findMany({
          where: { chatRoomId: chatroomId },
          orderBy: { createdAt: 'asc' }, 
          select: { role: true, content: true },
        });

        const historyForGemini = chatHistory.map(msg => ({
          role: msg.role === Role.USER ? 'user' : 'model',
          parts: [{ text: msg.content }],
        }));
  
        const chat = model.startChat({
          history: historyForGemini,
          generationConfig: {
            maxOutputTokens: 2000
          }
        });
  
        try {

          // Send the user's latest message to Gemini
          const geminiResult = await chat.sendMessage(userContent);
          const geminiResponse = geminiResult.response;
          const geminiText = geminiResponse.text();
  
          await localPrismaClient.message.create({
            data: {
              chatRoomId: chatroomId,
              role: Role.GEMINI,
              content: geminiText,
            },
          });
  
          // Update user's daily prompt count (for rate limiting)
          const user = await localPrismaClient.user.findUnique({
              where: { id: userId },
              include: { subscription: true }
          });
  
          if (user) {
              const activeSubscription = user.subscription.find(sub => sub.status === SubscriptionStatus.ACTIVE);
              const isBasicUser = activeSubscription?.tier === 'BASIC';
  
              if (isBasicUser) {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0); // Normalize to start of day
  
                  // Check if lastPromptReset was before today
                  if (!user.lastPromptReset || user.lastPromptReset.getTime() < today.getTime()) {
                      await localPrismaClient.user.update({
                          where: { id: userId },
                          data: {
                              dailyPromptCount: 1,
                              lastPromptReset: today,
                          },
                      });
                  } else {
                      await localPrismaClient.user.update({
                          where: { id: userId },
                          data: {
                              dailyPromptCount: {
                                  increment: 1,
                              },
                          },
                      });
                  }
              }
          }
  
  
        } catch (geminiErr: any) {
          console.error(`Error interacting with Gemini API for chatroom ${chatroomId}:`, geminiErr);
          await localPrismaClient.message.create({
            data: {
              chatRoomId: chatroomId,
              role: Role.GEMINI,
              content: 'Error: Could not get a response from AI. Please try again.',
            },
          });
        }
      }
    } catch (workerError: any) {
      console.error('Unhandled error in worker:', workerError);
    } finally {
      process.nextTick(processQueue);
    }
  }
  
  // Start the queue processing
  processQueue();

  // Graceful shutdown for worker
process.on('SIGTERM', async () => {
    console.log('Worker SIGTERM received. Shutting down gracefully.');
    await localPrismaClient.$disconnect();
    await localRedis.quit();
    console.log('Worker Prisma and Redis clients disconnected. Worker exited.');
    process.exit(0);
  });
  
  process.on('SIGINT', async () => {
    console.log('Worker SIGINT received. Shutting down gracefully.');
    await localPrismaClient.$disconnect();
    await localRedis.quit();
    console.log('Worker Prisma and Redis clients disconnected. Worker exited.');
    process.exit(0);
  });