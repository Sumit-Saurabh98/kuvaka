import 'dotenv/config';
import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/auth.js";
import { AppError, catchAsync } from "../../utils/errorHandler.js";
import { localPrismaClient } from "../../utils/prisma.js";
import jwt from "jsonwebtoken";

// --- Auth Controller ---
const authService = new AuthService();

// --- signup ---
export const signup = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: 'fail', message: 'Email is required for signup.' });
    }

    await authService.signup(email);

    res.status(200).json({
      status: 'success',
      message: 'OTP sent to your email.',
    });
  });


  // --- send otp ---
  export const reSendOtp = catchAsync(async (req: Request, res: Response) => {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ status: 'fail', message: 'Email is required.' });
    }

    await authService.sendOtp(email);
    res.status(200).json({
      status: 'success',
      message: 'OTP sent to your email.',
    });
  });

  // --- verify otp ---
  export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ status: 'fail', message: 'Email and OTP are required.' });
    }

    const { accessToken, refreshToken } = await authService.verifyOtp(email, otp);

    // Set httpOnly cookie with refresh token
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully.',
      data: {
        accessToken,
      },
    });
  });





  // --- refresh token ---
  export const refreshToken = catchAsync(async (req: Request, res: Response) => {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ status: 'fail', message: 'Refresh token not found.' });
    }

    const newAccessToken = await authService.refreshAccessToken(refreshToken);
    res.status(200).json({
      status: 'success',
      data: {
        accessToken: newAccessToken,
      },
    });
  });

  // --- logout ---
  export const logout = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
       return next(new AppError('User not authenticated.', 401));
    }

    // Clear refresh token from database
    await localPrismaClient.user.update({
      where: { id: req.user.id },
      data: { refreshToken: null },
    });

    // Clear the refresh token cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    res.status(200).json({
      status: 'success',
      message: 'Logged out successfully.',
    });
  });

  // --- get me ---
  export const getMe = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.id) {
       return next(new AppError('User not authenticated.', 401));
    }

    const userDetails = await authService.getUserDetails(req.user.id);

    res.status(200).json({
      status: 'success',
      data: {
        user: userDetails,
      },
    });
  });
