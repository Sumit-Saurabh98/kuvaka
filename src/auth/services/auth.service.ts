import "dotenv/config";
import bcrypt from "bcryptjs";
import { localPrismaClient, SubscriptionStatus, SubscriptionTier } from "../../utils/prisma.js";
import jwt from "jsonwebtoken";
import { AppError } from "../../utils/errorHandler.js";


const JWT_SECRET = process.env.JWT_SECRET!;
const OTP_EXPIRATION_MINUTES = parseInt(
  process.env.OTP_EXPIRATION_MINUTES || "5",
  10
);
const PASSWORD_SALT_ROUNDS = parseInt(
  process.env.PASSWORD_SALT_ROUNDS || "10",
  10
);

export class AuthService {

  async signup(mobileNumber: string, password?: string): Promise<{ id: string, mobileNumber: string }> {
    let user = await localPrismaClient.user.findUnique({
      where: { mobileNumber },
    });

    if (user) {
      throw new AppError('User with this mobile number already exists.', 409);
    }

    let hashedPassword = undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, PASSWORD_SALT_ROUNDS);
    }

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

  async sendOtp(mobileNumber: string): Promise<string> {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpireAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    const user = await localPrismaClient.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new AppError('User not found. Please create an account.', 404);
    }

    await localPrismaClient.user.update({
      where: { mobileNumber },
      data: {
        otp,
        otpExpireAt,
      },
    });

    return otp;
  }

  async verifyOtp(mobileNumber: string, otp: string): Promise<string> {
    const user = await localPrismaClient.user.findUnique({
      where: { mobileNumber },
      include: { subscription: true },
    });

    if (!user) {
      throw new AppError("User not found.", 404);
    }

    if (!user.otp || user.otp !== otp) {
      throw new AppError("Invalid OTP.", 401);
    }
    if (user.otpExpireAt && user.otpExpireAt < new Date()) {
      throw new AppError("OTP expired.", 401);
    }

    await localPrismaClient.user.update({
      where: { id: user.id },
      data: {
        otp: null,
        otpExpireAt: null,
      },
    });

    const activeSubscription = user.subscription.find(
      (sub) => sub.status === SubscriptionStatus.ACTIVE
    );
    
    const userTier: SubscriptionTier = activeSubscription?.tier || SubscriptionTier.BASIC;

    const token = jwt.sign(
      { id: user.id, mobileNumber: user.mobileNumber, tier: userTier },
      JWT_SECRET,
      { expiresIn: '1d' }
    );

    return token;
  }

  async forgotPasswordOtp(mobileNumber: string): Promise<string> {
    const user = await localPrismaClient.user.findUnique({
      where: { mobileNumber },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpireAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    await localPrismaClient.user.update({
      where: { id: user.id },
      data: { otp, otpExpireAt },
    });

    return otp;
  }

  async changePassword(userId: string, newPassword: string): Promise<void> {
    if (!newPassword || newPassword.length < 6) {
      throw new AppError('Password must be at least 6 characters long.', 400);
    }
    const hashedPassword = await bcrypt.hash(newPassword, PASSWORD_SALT_ROUNDS);

    await localPrismaClient.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });
  }

  async getUserDetails(userId: string) {
    const user = await localPrismaClient.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mobileNumber: true,
        createdAt: true,
        updatedAt: true,
        subscription: {
          where: {
            status: SubscriptionStatus.ACTIVE
          },
          select: {
            tier: true,
            status: true,
            currentPeriodStart: true,
            currentPeriodEnd: true,
          },
          take: 1
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
      currentSubscription: user.subscription.length > 0 ? user.subscription[0] : null
    };
  }
}
