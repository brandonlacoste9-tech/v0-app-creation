export type StudioToolName = "scrape_url" | "generate_image";

export type StudioToolEvent = {
  name: StudioToolName;
  status: "running" | "done" | "error";
  summary: string;
  url?: string;
};

export function serializeToolLog(events: StudioToolEvent[]): string {
  const done = events.filter((e) => e.status !== "running");
  if (!done.length) return "";
  return `:::shipboard-tools\n${JSON.stringify(done)}\n:::\n\n`;
}

export function parseToolLog(content: string): {
  events: StudioToolEvent[];
  rest: string;
} {
  const m = content.match(/^:::shipboard-tools\n([\s\S]*?)\n:::\n*/);
  if (!m) return { events: [], rest: content };
  try {
    const events = JSON.parse(m[1]) as StudioToolEvent[];
    return {
      events: Array.isArray(events) ? events : [],
      rest: content.slice(m[0].length),
    };
  } catch {
    return { events: [], rest: content };
  }
}
