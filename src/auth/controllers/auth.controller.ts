import 'dotenv/config';
import { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/auth.service.js";
import { AppError, catchAsync } from "../../utils/errorHandler.js";

// --- Auth Controller ---
const authService = new AuthService();

// --- signup ---
export const signup = catchAsync(async (req: Request, res: Response) => {
    const { mobileNumber, password } = req.body; // mobileNumber, password from body
  
    if (!mobileNumber) {
      return res.status(400).json({ status: 'fail', message: 'Mobile number is required for signup.' });
    }
  
    const user = await authService.signup(mobileNumber, password);
  
    res.status(201).json({
      status: 'success',
      message: 'User registered successfully.',
      userId: user.id,
      mobileNumber: user.mobileNumber
    });
  });


  // --- send otp ---
  export const sendOtp = catchAsync(async (req: Request, res: Response) => {
    const { mobileNumber } = req.body;
  
    if (!mobileNumber) {
      return res.status(400).json({ status: 'fail', message: 'Mobile number is required.' });
    }
  
    const otp = await authService.sendOtp(mobileNumber);
    res.status(200).json({
      status: 'success',
      message: 'OTP sent successfully.',
      otp: otp
    });
  });

  // --- verify otp ---
  export const verifyOtp = catchAsync(async (req: Request, res: Response) => {
    const { mobileNumber, otp } = req.body;
  
    if (!mobileNumber || !otp) {
      return res.status(400).json({ status: 'fail', message: 'Mobile number and OTP are required.' });
    }
  
    const token = await authService.verifyOtp(mobileNumber, otp);
    res.status(200).json({
      status: 'success',
      message: 'OTP verified successfully.',
      token,
    });
  });


  // --- forgot password ---
  export const forgotPassword = catchAsync(async (req: Request, res: Response) => {
    const { mobileNumber } = req.body;
  
    if (!mobileNumber) {
      return res.status(400).json({ status: 'fail', message: 'Mobile number is required for password reset.' });
    }
  
    const otp = await authService.forgotPasswordOtp(mobileNumber);
    res.status(200).json({
      status: 'success',
      message: 'OTP for password reset sent successfully (mocked).',
      otp: otp,
    });
  });



  // --- change password ---
  export const changePassword = catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const { newPassword } = req.body;
  
    if (!req.user || !req.user.id) {
       return next(new AppError('User not authenticated.', 401));
    }
    if (!newPassword) {
      return res.status(400).json({ status: 'fail', message: 'New password is required.' });
    }
  
    await authService.changePassword(req.user.id, newPassword);
  
    res.status(200).json({
      status: 'success',
      message: 'Password changed successfully.',
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
