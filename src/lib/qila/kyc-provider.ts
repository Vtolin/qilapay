import { db } from "@/lib/db";

/**
 * KycProvider abstraction (spec 5.4). Swap MockKycProvider with a real
 * sandbox provider (Persona / Sumsub) by implementing this interface.
 */

export type KycMethod =
  | "selfie_liveness"
  | "age_estimation"
  | "id_face_match"
  | "bank_micro_deposit"
  | "proof_of_address"
  | "source_of_funds"
  | "video_call";

export type KycSubmitResult = {
  providerRef: string;
  status: "pending" | "approved" | "rejected" | "needs_more_info";
};

export interface KycProvider {
  readonly name: string;
  submit(args: {
    userId: string;
    method: KycMethod;
    targetTier: number;
    payload?: Record<string, unknown>;
  }): Promise<KycSubmitResult>;
  /** Fetch provider-side status (real providers poll here). */
  check(providerRef: string): Promise<KycSubmitResult>;
}

export function isDemoMode(): boolean {
  return (process.env.DEMO_MODE || "").toLowerCase() === "true";
}

/**
 * MockKycProvider — simulates the provider. Verifications stay "pending"
 * until the user (or admin) simulates an outcome. Only available when
 * DEMO_MODE=true; production implementations replace this entirely.
 */
export class MockKycProvider implements KycProvider {
  readonly name = "mock";

  async submit(args: {
    userId: string;
    method: KycMethod;
    targetTier: number;
    payload?: Record<string, unknown>;
  }): Promise<KycSubmitResult> {
    const verification = await db.kycVerification.create({
      data: {
        userId: args.userId,
        method: args.method,
        targetTier: args.targetTier,
        status: "pending",
        providerRef: `mock_${Date.now().toString(36)}`,
        payload: JSON.stringify(args.payload || {}),
      },
    });
    await db.auditLog.create({
      data: {
        actor: args.userId,
        action: "kyc.submit",
        entity: "kyc_verification",
        entityId: verification.id,
        meta: JSON.stringify({ method: args.method, targetTier: args.targetTier, provider: this.name }),
      },
    });
    return { providerRef: verification.id, status: "pending" };
  }

  async check(providerRef: string): Promise<KycSubmitResult> {
    const v = await db.kycVerification.findUnique({ where: { id: providerRef } });
    return { providerRef, status: (v?.status as KycSubmitResult["status"]) || "pending" };
  }
}

export const kycProvider: KycProvider = new MockKycProvider();
