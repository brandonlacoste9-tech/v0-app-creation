import { getGitHubToken } from "./github-token";
import { storage } from "./storage";

export async function getCurrentUser() {
  const token = await getGitHubToken();
  if (!token) return null;
  return storage.getUser(token.username);
}
