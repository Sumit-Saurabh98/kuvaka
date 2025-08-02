import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        mobileNumber: string;
        tier: 'BASIC' | 'PRO';
      };
    }
  }
}