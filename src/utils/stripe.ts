import Stripe from 'stripe';
import dotenv from 'dotenv';
dotenv.config();

// --- Initialize Stripe ---
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-07-30.basil', 
});