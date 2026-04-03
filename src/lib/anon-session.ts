import { cookies } from "next/headers";

const COOKIE_NAME = "adgen_anon";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

interface AnonSession {
  id: string;
  generationsToday: number;
  generationDate: string; // YYYY-MM-DD
  projectCount: number;
}

export async function getAnonSession(): Promise<AnonSession> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(COOKIE_NAME);
  if (cookie?.value) {
    try {
      const session = JSON.parse(cookie.value) as AnonSession;
      // Reset daily count if date changed
      const today = new Date().toISOString().slice(0, 10);
      if (session.generationDate !== today) {
        session.generationsToday = 0;
        session.generationDate = today;
      }
      return session;
    } catch {
      /* fall through to create new */
    }
  }
  return {
    id: crypto.randomUUID(),
    generationsToday: 0,
    generationDate: new Date().toISOString().slice(0, 10),
    projectCount: 0,
  };
}

export async function saveAnonSession(session: AnonSession): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: MAX_AGE,
    path: "/",
  });
}
