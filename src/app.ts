import express, { Application, NextFunction, Request, Response } from 'express';
import { localPrismaClient } from './utils/prisma.js';
import { AppError, globalErrorHandler } from './utils/errorHandler.js';
import authRoutes from './auth/routes/auth.routes.js';
import chatroomRoutes from './chatrooms/routes/chatroom.routes.js'
import subscriptionRoutes from './subscriptions/routes/subscription.routes.js';

const app: Application = express();
const PORT = process.env.PORT || 7002;

// IMPORTANT: one raw-body middleware applied only for Stripe webhook path
app.use("/api/v1/webhook/stripe", express.raw({ type: "application/json" }));


app.use(express.json());

app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Server is healthy!' });
});


// --- routes ---
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/chatroom', chatroomRoutes);
app.use("/api/v1", subscriptionRoutes);


// --- unhandled routes ---
app.use((req, _res, next) => next(new AppError(`Cannot find ${req.originalUrl}`, 404)));

// --- global error handler ---
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access it at: http://localhost:${PORT}`);
});

process.on('beforeExit', async () => {
  await localPrismaClient.$disconnect();
  console.log('Prisma client disconnected.');
});