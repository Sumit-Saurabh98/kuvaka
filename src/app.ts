import express, { Application, Request, Response } from 'express';
import { localPrismaClient } from './utils/prisma.js';

const app: Application = express();
const PORT = process.env.PORT || 7002;

app.use(express.json());

app.get('/healthz', (req: Request, res: Response) => {
  res.status(200).json({ message: 'Server is healthy!' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Access it at: http://localhost:${PORT}`);
});

process.on('beforeExit', async () => {
  await localPrismaClient.$disconnect();
  console.log('Prisma client disconnected.');
});