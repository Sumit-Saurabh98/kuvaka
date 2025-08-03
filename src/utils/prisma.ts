import { PrismaClient } from "../../prisma/src/generated/prisma/index.js";
import { SubscriptionStatus, SubscriptionTier, Role } from "../../prisma/src/generated/prisma/index.js";

export const localPrismaClient = new PrismaClient();
export { SubscriptionStatus, SubscriptionTier, Role }