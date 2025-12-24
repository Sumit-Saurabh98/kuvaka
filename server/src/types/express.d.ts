import { Request } from 'express';

declare global {
  namespace Express {
    // Extend user to Request
    interface Request {
      user?: {
        id: string;
        email: string;
        tier: 'BASIC' | 'PRO';
      };
    }
  }
}
