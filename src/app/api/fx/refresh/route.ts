import { ok, handleError } from "@/lib/qila/api";
import { refreshFxRates } from "@/lib/qila/fx";

/** POST: refresh FX rates (also callable on a schedule). */
export async function POST() {
  try {
    const rates = await refreshFxRates();
    return ok({ rates, refreshedAt: new Date().toISOString() });
  } catch (e) {
    return handleError(e);
  }
}
