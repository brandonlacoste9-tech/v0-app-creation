import { getGitHubToken } from "./github-token";
import { getAuthSession } from "./auth-session";
import { storage } from "./storage";
import type { User } from "./storage";

export async function getCurrentUser(): Promise<User | null> {
  // Preferred: unified auth session (GitHub or Google)
  const session = await getAuthSession();
  if (session?.userId) {
    const byId = await storage.getUserById(session.userId);
    if (byId) return byId;
  }

  // Legacy: GitHub token cookie only
  const token = await getGitHubToken();
  if (!token) return null;
  return storage.getUser(token.username);
}
