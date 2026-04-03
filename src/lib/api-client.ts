import type { Session, Message, CodeVersion, GitHubStatus, GitHubRepo, AIProvider, BrandKit } from "./types";

async function api(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res;
}

// Sessions
export async function fetchSessions(): Promise<Session[]> {
  return (await api("GET", "/api/sessions")).json();
}

export async function createSession(data: { id: string; title?: string; model?: string }): Promise<Session> {
  return (await api("POST", "/api/sessions", data)).json();
}

export async function updateSession(id: string, data: Partial<Session>): Promise<Session> {
  return (await api("PATCH", `/api/sessions/${id}`, data)).json();
}

export async function deleteSession(id: string): Promise<void> {
  await api("DELETE", `/api/sessions/${id}`);
}

// Messages
export async function fetchMessages(sessionId: string): Promise<Message[]> {
  return (await api("GET", `/api/sessions/${sessionId}/messages`)).json();
}

// Versions
export async function fetchVersions(sessionId: string): Promise<CodeVersion[]> {
  return (await api("GET", `/api/sessions/${sessionId}/versions`)).json();
}

export async function saveVersion(
  sessionId: string,
  data: { id: string; code: string; title: string }
): Promise<CodeVersion> {
  return (await api("POST", `/api/sessions/${sessionId}/versions`, data)).json();
}

export async function updateVersion(
  sessionId: string,
  versionId: string,
  code: string
): Promise<CodeVersion> {
  return (await api("PATCH", `/api/sessions/${sessionId}/versions`, { versionId, code })).json();
}

// GitHub
export async function fetchGitHubStatus(): Promise<GitHubStatus> {
  return (await api("GET", "/api/github/status")).json();
}

export async function startGitHubAuth(): Promise<{ url: string }> {
  return (await api("GET", "/api/github/auth")).json();
}

export async function disconnectGitHub(): Promise<void> {
  await api("DELETE", "/api/github/disconnect");
}

export async function fetchGitHubRepos(): Promise<GitHubRepo[]> {
  return (await api("GET", "/api/github/repos")).json();
}

export async function createRepoAndPush(data: {
  repoName: string;
  description?: string;
  isPrivate: boolean;
  code: string;
  fileName?: string;
}): Promise<{ url: string; name: string; fullName: string }> {
  return (await api("POST", "/api/github/create-and-push", data)).json();
}

export async function pushToExistingRepo(data: {
  repoFullName: string;
  code: string;
  fileName?: string;
  commitMessage?: string;
  branch?: string;
}): Promise<{ url: string; sha: string }> {
  return (await api("POST", "/api/github/push", data)).json();
}

// Deploy
export async function deployProject(data: {
  code: string;
  title: string;
  repoName?: string;
}): Promise<{ repoUrl: string; repoFullName: string; vercelImportUrl: string; repoName: string }> {
  return (await api("POST", "/api/deploy", data)).json();
}

// Streaming chat
export function streamChat(
  sessionId: string,
  message: string,
  provider: AIProvider,
  model: string,
  apiKey: string,
  ollamaUrl: string,
  temperature: number,
  onDelta: (text: string) => void,
  onTitle?: (title: string) => void,
  onDone?: () => void,
  onError?: (error: string) => void,
  extra?: {
    customSystemPrompt?: string;
    maxTokens?: number;
    outputFormat?: "tsx" | "jsx" | "html";
    brandKit?: BrandKit;
    previewTheme?: string;
  }
): AbortController {
  const controller = new AbortController();

  (async () => {
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message,
          provider,
          model,
          apiKey: apiKey || undefined,
          ollamaUrl,
          temperature,
          customSystemPrompt: extra?.customSystemPrompt,
          maxTokens: extra?.maxTokens,
          outputFormat: extra?.outputFormat,
          brandKit: extra?.brandKit,
          previewTheme: extra?.previewTheme,
        }),
        signal: controller.signal,
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.type === "delta") onDelta(parsed.text);
            else if (parsed.type === "title" && onTitle) onTitle(parsed.title);
            else if (parsed.type === "done" && onDone) onDone();
            else if (parsed.type === "error" && onError) onError(parsed.error);
          } catch {
            /* skip malformed */
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        onError?.(err.message || "Stream failed");
      }
    }
  })();

  return controller;
}
