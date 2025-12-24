import "dotenv/config";
import crypto from "crypto";
import { localPrismaClient, SubscriptionStatus, SubscriptionTier } from "../../utils/prisma.js";
import jwt from "jsonwebtoken";
import { AppError } from "../../utils/errorHandler.js";
import { sendOnboardingOTPEmail, sendWelcomeBackOTPEmail } from "../../utils/email.js";
import { localRedis } from "../../utils/redis.js";


const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET! || process.env.JWT_SECRET!;

// --- otp expiration in minutes
const OTP_EXPIRATION_MINUTES = parseInt(
  process.env.OTP_EXPIRATION_MINUTES || "5",
  10
);


// --- Auth Service ---
export class AuthService {

  // --- generate tokens ---
  private generateTokens(user: { id: string; email: string; tier: string }) {
    const accessToken = jwt.sign(
      { id: user.id, email: user.email, tier: user.tier },
      JWT_SECRET,
      { expiresIn: '15m' } // Short-lived access token
    );

    const refreshToken = jwt.sign(
      { id: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' } // Long-lived refresh token
    );

    // Hash refresh token for storage
    const hashedRefreshToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

    return { accessToken, refreshToken, hashedRefreshToken };
  }

  // --- verify and generate new access token ---
  async refreshAccessToken(refreshToken: string): Promise<string> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { id: string };

      // Hash the provided token and check against stored hash
      const hashedToken = crypto.createHash('sha256').update(refreshToken).digest('hex');

      const user = await localPrismaClient.user.findUnique({
        where: { id: decoded.id },
        include: { subscription: true },
      });

      if (!user || user.refreshToken !== hashedToken) {
        throw new AppError('Invalid refresh token.', 401);
      }

      const activeSubscription = user.subscription?.status === SubscriptionStatus.ACTIVE ? user.subscription : null;
      const userTier = activeSubscription?.tier || SubscriptionTier.BASIC;

      // Generate new access token
      const accessToken = jwt.sign(
        { id: user.id, email: user.email, tier: userTier },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      return accessToken;
    } catch (error) {
      throw new AppError('Invalid refresh token.', 401);
    }
  }

  // --- signup/login ---
  async signup(email: string): Promise<void> {
    // check if user already exists
    const existingUser = await localPrismaClient.user.findUnique({
      where: { email },
    });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpireAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

    if (existingUser) {
      // existing user - send welcome back OTP and update user
      await localPrismaClient.user.update({
        where: { email },
        data: { otp, otpExpireAt },
      });
      await sendWelcomeBackOTPEmail(email, otp);
    } else {
      // new user - check Redis for pending signup
      const pendingKey = `pending_signup:${email}`;
      const existingPending = await localRedis.get(pendingKey);
      if (existingPending) {
        throw new AppError('Signup already initiated. Please verify OTP.', 400);
      }

      // store in Redis
      const signupData = {
        email,
        otp,
        otpExpireAt: otpExpireAt.toISOString(),
      };
      await localRedis.setex(pendingKey, OTP_EXPIRATION_MINUTES * 60, JSON.stringify(signupData));

      // send onboarding OTP email
      await sendOnboardingOTPEmail(email, otp);
    }
  }

  // --- send otp ---
  async sendOtp(email: string): Promise<void> {
    // Check if user exists in DB
    const user = await localPrismaClient.user.findUnique({
      where: { email },
    });

    if (user) {
      // Existing user - send welcome back OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpireAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

      await localPrismaClient.user.update({
        where: { email },
        data: { otp, otpExpireAt },
      });

      await sendWelcomeBackOTPEmail(email, otp);
    } else {
      // Check if pending signup in Redis
      const pendingKey = `pending_signup:${email}`;
      const pendingData = await localRedis.get(pendingKey);

      if (pendingData) {
        // Resend onboarding OTP
        const signupData = JSON.parse(pendingData);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpireAt = new Date(Date.now() + OTP_EXPIRATION_MINUTES * 60 * 1000);

        // Update Redis with new OTP
        const updatedSignupData = {
          ...signupData,
          otp,
          otpExpireAt: otpExpireAt.toISOString(),
        };
        await localRedis.setex(pendingKey, OTP_EXPIRATION_MINUTES * 60, JSON.stringify(updatedSignupData));

        await sendOnboardingOTPEmail(email, otp);
      } else {
        throw new AppError('User not found. Please create an account.', 404);
      }
    }
  }

  // --- verify otp ---
  async verifyOtp(email: string, otp: string): Promise<{ accessToken: string; refreshToken: string }> {
    // check Redis first for pending signup
    const pendingKey = `pending_signup:${email}`;
    const pendingData = await localRedis.get(pendingKey);

    if (pendingData) {
      const signupData = JSON.parse(pendingData);
      if (signupData.otp !== otp) {
        throw new AppError('Invalid OTP.', 401);
      }
      if (new Date(signupData.otpExpireAt) < new Date()) {
        await localRedis.del(pendingKey);
        throw new AppError('OTP expired.', 401);
      }

      // create user
      const user = await localPrismaClient.user.create({
        data: {
          email: signupData.email,
          subscription: {
            create: {
              tier: SubscriptionTier.BASIC,
              status: SubscriptionStatus.ACTIVE,
            },
          },
        },
      });

      // delete from Redis
      await localRedis.del(pendingKey);

      // generate tokens
      const { accessToken, refreshToken, hashedRefreshToken } = this.generateTokens({
        id: user.id,
        email: user.email,
        tier: SubscriptionTier.BASIC,
      });

      // store hashed refresh token
      await localPrismaClient.user.update({
        where: { id: user.id },
        data: { refreshToken: hashedRefreshToken },
      });

      return { accessToken, refreshToken };
    }

    // existing user verification
    const user = await localPrismaClient.user.findUnique({
      where: { email },
      include: { subscription: true },
    });

    if (!user) {
      throw new AppError('User not found.', 404);
    }

    if (!user.otp || user.otp !== otp) {
      throw new AppError('Invalid OTP.', 401);
    }

    if (user.otpExpireAt && user.otpExpireAt < new Date()) {
      throw new AppError('OTP expired.', 401);
    }

    const activeSubscription = user.subscription?.status === SubscriptionStatus.ACTIVE ? user.subscription : null;
    const userTier = activeSubscription?.tier || SubscriptionTier.BASIC;

    // generate tokens
    const { accessToken, refreshToken, hashedRefreshToken } = this.generateTokens({
      id: user.id,
      email: user.email,
      tier: userTier,
    });

    // clear OTP and store hashed refresh token
    await localPrismaClient.user.update({
      where: { id: user.id },
      data: { otp: null, otpExpireAt: null, refreshToken: hashedRefreshToken },
    });

    return { accessToken, refreshToken };
  }



  // --- get user details ---
  async getUserDetails(userId: string) {
    const user = await localPrismaClient.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
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
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      currentSubscription: user.subscription?.status === SubscriptionStatus.ACTIVE ? user.subscription : null
    };
  }
}
