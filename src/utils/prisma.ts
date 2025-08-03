import { PrismaClient } from "../../prisma/src/generated/prisma/index.js";
import { SubscriptionStatus, SubscriptionTier, Role } from "../../prisma/src/generated/prisma/index.js";

// --- initilize prisma client --
export const localPrismaClient = new PrismaClient();

// --- exported enums --
export { SubscriptionStatus, SubscriptionTier, Role }