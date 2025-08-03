import { Request } from 'express';

declare global {
  namespace Express {
    // Extend user to Request
    interface Request {
      user?: {
        id: string;
        mobileNumber: string;
        tier: 'BASIC' | 'PRO';
      };
    }
  }
}