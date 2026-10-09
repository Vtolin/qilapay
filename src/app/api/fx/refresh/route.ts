import { ok, fail, handleError } from "@/lib/qila/api";
import { requireUser } from "@/lib/qila/session";
import { checkRateLimit } from "@/lib/qila/rate-limit";
import { refreshFxRates } from "@/lib/qila/fx";

/** POST: refresh FX rates (also callable on a schedule). */
export async function POST() {
  try {
    // Audit M5: authenticated + throttled — this fans out to an external
    // fetch plus N DB upserts per call.
    const user = await requireUser();
    if (
      !checkRateLimit(`fx:refresh:${user.id}`, { limit: 10, windowMs: 60 * 60 * 1000 }).allowed ||
      !checkRateLimit("fx:refresh:global", { limit: 60, windowMs: 60 * 60 * 1000 }).allowed
    ) {
      return fail("Too many refreshes. Try again later", 429);
    }
    const rates = await refreshFxRates();
    return ok({ rates, refreshedAt: new Date().toISOString() });
  } catch (e) {
    return handleError(e);
  }
}
