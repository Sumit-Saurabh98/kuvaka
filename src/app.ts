import express, { Application, NextFunction, Request, Response } from 'express';
import { localPrismaClient } from './utils/prisma.js';
import authRoutes from './auth/routes/auth.routes.js';
import { AppError, globalErrorHandler } from './utils/errorHandler.js';

const app: Application = express();
const PORT = process.env.PORT || 7002;

app.use(express.json());

app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Server is healthy!' });
});


// --- routes ---
app.use('/api/v1/auth', authRoutes);


// --- unhandled routes ---
app.use((req: Request, res: Response, next: NextFunction) => {
  next(new AppError(`Can't find ${req.originalUrl} on this server!`, 404));
});

// --- Global Error Handler ---
app.use(globalErrorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access it at: http://localhost:${PORT}`);
});

process.on('beforeExit', async () => {
  await localPrismaClient.$disconnect();
  console.log('Prisma client disconnected.');
});