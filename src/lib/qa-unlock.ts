import {
  getAnonSession,
  saveAnonSession,
  type AnonSession,
} from "./anon-session";
import { qaUnlockFromRequest } from "./promo-codes";

/** If the probe header matches QA_UNLOCK_CODE, persist Max on the anon cookie. */
export async function applyQaUnlockFromRequest(
  req: Request,
  anon?: AnonSession | null
): Promise<AnonSession | null> {
  if (!qaUnlockFromRequest(req)) return anon ?? null;
  const session = anon ?? (await getAnonSession());
  if (session.plan !== "max") {
    session.plan = "max";
    session.promoCode = "qa";
    session.generationsToday = 0;
    await saveAnonSession(session);
  }
  return session;
}
