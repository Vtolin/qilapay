import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Audit M6: query logging only outside production (PII + SQL in logs).
    log: process.env.NODE_ENV === "production" ? ["error"] : ["query"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db