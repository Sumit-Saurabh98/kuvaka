import nodemailer from 'nodemailer';
import 'dotenv/config';

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD, // Use App Password for Gmail
  },
});

// Send OTP email for new users (onboarding)
export const sendOnboardingOTPEmail = async (email: string, otp: string) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Welcome to Kuvaka - Verify Your Email',
    text: `Welcome to Kuvaka! Your OTP is: ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <h1 style="color: #333; text-align: center; margin-bottom: 20px;">Welcome to Kuvaka!</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for joining Kuvaka. We're excited to have you on board!
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #007bff; color: white; padding: 15px 30px; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
              ${otp}
            </div>
          </div>
          <p style="color: #666; font-size: 14px; text-align: center;">
            This OTP expires in 5 minutes. Please use it to complete your registration.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Onboarding OTP email sent to', email);
  } catch (error) {
    console.error('Error sending onboarding OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};

// Send OTP email for existing users (welcome back)
export const sendWelcomeBackOTPEmail = async (email: string, otp: string) => {
  const mailOptions = {
    from: process.env.GMAIL_USER,
    to: email,
    subject: 'Welcome Back to Kuvaka - Your Login OTP',
    text: `Welcome back to Kuvaka! Your OTP is: ${otp}. It expires in 5 minutes.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f4f4f4;">
        <div style="background-color: white; padding: 30px; border-radius: 10px; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
          <h1 style="color: #333; text-align: center; margin-bottom: 20px;">Welcome Back to Kuvaka!</h1>
          <p style="color: #666; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Great to see you again! Please use the OTP below to log in to your account.
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="display: inline-block; background-color: #28a745; color: white; padding: 15px 30px; border-radius: 5px; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
              ${otp}
            </div>
          </div>
          <p style="color: #666; font-size: 14px; text-align: center;">
            This OTP expires in 5 minutes. For your security, please don't share it with anyone.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px; text-align: center;">
            If you didn't request this login, please contact our support team.
          </p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Welcome back OTP email sent to', email);
  } catch (error) {
    console.error('Error sending welcome back OTP email:', error);
    throw new Error('Failed to send OTP email');
  }
};
