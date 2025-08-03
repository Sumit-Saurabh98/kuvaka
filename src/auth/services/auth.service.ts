import "dotenv/config";
import bcrypt from "bcryptjs";
import { localPrismaClient, SubscriptionStatus, SubscriptionTier } from "../../utils/prisma.js";
import jwt from "jsonwebtoken";
import { AppError } from "../../utils/errorHandler.js";


const JWT_SECRET = process.env.JWT_SECRET!;

// --- otp expiration in minutes
const OTP_EXPIRATION_MINUTES = parseInt(
  process.env.OTP_EXPIRATION_MINUTES || "5",
  10
);

// --- password salt rounds
const PASSWORD_SALT_ROUNDS = parseInt(
  process.env.PASSWORD_SALT_ROUNDS || "10",
  10
);


// --- Auth Service ---
export class AuthService {


  // --- signup ---
  async signup(mobileNumber: string, password?: string): Promise<{ id: string, mobileNumber: string }> {

    // check if user already exists
    let user = await localPrismaClient.user.findUnique({
      where: { mobileNumber },
    });

    if (user) {
      throw new AppError('User with this mobile number already exists.', 409);
    }

    let hashedPassword = undefined;

    // passord hashing
    if (password) {
      hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    }

    // create new user
    user = await localPrismaClient.user.create({
      data: {
        mobileNumber,
        password: hashedPassword,
        subscription: { 
          create: {
            tier: SubscriptionTier.BASIC,
            status: SubscriptionStatus.ACTIVE,
          },
        },
      },
    });

    return { id: user.id, mobileNumber: user.mobileNumber };
  }


  // --- send otp ---
  async sendOtp(mobileNumber: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // generate random 6 digit otp
    // expires in next 5 minutes
    const otpExpireAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    // get the user using mobileNumber
    const user = await localPrismaClient.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new AppError('User not found. Please create an account.', 404);
    }

    // update otp and otpExpireAt for future verification
    await localPrismaClient.user.update({
      where: { mobileNumber },
      data: {
        otp,
        otpExpireAt,
      },
    });

    return otp;
  }


  // --- verify otp ---
  async verifyOtp(mobileNumber: string, otp: string): Promise<string> {
    
    // get user
    const user = await localPrismaClient.user.findUnique({
      where: { mobileNumber },
      include: { subscription: true },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    // if otp is not there or does not match
    if (!user.otp || user.otp !== otp) {
      throw new AppError("Invalid OTP.", 401);
    }

    // if otp is expired
    if (user.otpExpireAt && user.otpExpireAt < new Date()) {
      throw new AppError("OTP expired.", 401);
    }

    // clear otp
    await localPrismaClient.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpireAt: null,
      },
    });

    // get user's active subscription
    const activeSubscription =
  user.subscription?.status === SubscriptionStatus.ACTIVE ? user.subscription : null;

    
    const userTier: SubscriptionTier = activeSubscription?.tier || SubscriptionTier.BASIC;

    // generate token, includes user id, mobile number and tier
    const token = jwt.sign(
      { id: user.id, mobileNumber: user.mobileNumber, tier: userTier },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return token;
  }


  // --- forgot password ---
  async forgotPasswordOtp(mobileNumber: string): Promise<string> {
    const user = await localPrismaClient.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    // generate random 6 digit otp
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpireAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    // update otp and otpExpireAt
    await localPrismaClient.user.update({
      where: { id: user.id },
      data: { otp, otpExpireAt },
    });

    return otp;
  }


  // --- change password ---
  async changePassword(userId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400);
    }

    // hash password
    const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);


    // update password
    await localPrismaClient.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }


  // --- get user details ---
  async getUserDetails(userId: string) {
    const user = await localPrismaClient.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mobileNumber: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          select: {
            tier: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          }
        }        
      }
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    return {
      id: user.id,
      mobileNumber: user.mobileNumber,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      currentSubscription: user.subscription?.status === SubscriptionStatus.ACTIVE ? user.subscription : null
    };
  }
}
