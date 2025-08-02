import 'dotenv/config';
import { Response, Request, NextFunction } from "express";
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/errorHandler.js';
import { localPrismaClient } from '../utils/prisma.js';

const JWT_SECRET = process.env.JWT_SECRET!;

type JWT_PAYLOAD = { id: string; mobileNumber: string; tier: 'BASIC' | 'PRO'; iat: number; exp: number; };

export const protect = async (req: Request, res: Response, next: NextFunction) => {
    
    let token:string | undefined;

    if(req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }

    if(!token) {
        return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    try {

        const decode = jwt.verify(token, JWT_SECRET) as JWT_PAYLOAD;

        const currentUser = await localPrismaClient.user.findUnique({
            where: {
                id: decode.id
            },
            include: {
                subscription: true
            }
        })

        if(!currentUser){
            return next(new AppError('The user belonging to this token does no longer exist.', 401));
        }

        const activeSubscription = currentUser.subscription.find(sub => sub.status === 'ACTIVE');
        const userTier = activeSubscription?.tier || 'BASIC';

        req.user = {
            id: currentUser.id,
            mobileNumber: currentUser.mobileNumber,
            tier: userTier
        }

        next();
        
    } catch (err: unknown) {
        const { JsonWebTokenError, TokenExpiredError } = jwt;
        if (err instanceof JsonWebTokenError) {
          return next(new AppError('Invalid token. Please log in again!', 401));
        }
        if (err instanceof TokenExpiredError) {
          return next(new AppError('Your token has expired! Please log in again.', 401));
        }
        console.error('An unexpected error occurred in auth.middleware:', err);
        next(new AppError('An unexpected authentication error occurred.', 500));
      }
}