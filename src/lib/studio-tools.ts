/**
 * Studio-side tools the chat model can call (Grok / OpenAI-compatible).
 * scrape_url = live public HTML facts. generate_image = Grok Imagine stills.
 */

import {
  factsToPromptBlock,
  fetchPublicPage,
  type PageFacts,
} from "./fetch-page";
import type { StudioToolEvent, StudioToolName } from "./studio-tool-log";

export type { StudioToolEvent, StudioToolName } from "./studio-tool-log";
export { serializeToolLog, parseToolLog } from "./studio-tool-log";

export const STUDIO_TOOL_DEFS = [
  {
    type: "function" as const,
    function: {
      name: "scrape_url",
      description:
        "Fetch a live public webpage and extract title, headings, emails, phones, hours-like lines, CTAs, and text. Use this BEFORE rebuilding a real business site. Do not invent contact facts that are not in the result.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Public https URL to fetch",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "generate_image",
      description:
        "Generate a still with Grok Imagine for a hero, product shot, or background. Returns an https URL to use in <img src>. Do not claim it is a real photo of the business or staff.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description: "Concrete visual description. No logos of other brands.",
          },
        },
        required: ["prompt"],
      },
    },
  },
];

export const STUDIO_TOOLS_SYSTEM = `
## STUDIO TOOLS
You can call scrape_url and generate_image when they help the build.

- scrape_url: required before rebuilding a real public website. After it returns, those emails/phones/hours/prices are the only contact facts you may print. If a fact is missing, omit it.
- generate_image: optional hero / product still. Use the returned URL in <img src="..."> with alt text. Never present generated people as real employees.

Do not call tools for Admin Users / Auth / Kanban unless the user pasted a URL or asked for a generated image.
`;

export function formatFactsForModel(facts: PageFacts): string {
  return factsToPromptBlock(facts);
}

export async function executeStudioTool(
  name: string,
  argsJson: string,
  opts: { xaiKey?: string }
): Promise<{ content: string; event: StudioToolEvent }> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return {
      content: JSON.stringify({ error: "Invalid tool arguments" }),
      event: {
        name: (name as StudioToolName) || "scrape_url",
        status: "error",
        summary: "Invalid tool arguments",
      },
    };
  }

  if (name === "scrape_url") {
    const url = String(args.url || "").trim();
    try {
      const facts = await fetchPublicPage(url);
      const summary = `${new URL(facts.url).hostname} · ${facts.headings.length} headings · ${facts.emails.length} emails`;
      return {
        content: formatFactsForModel(facts),
        event: { name: "scrape_url", status: "done", summary, url: facts.url },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Scrape failed";
      return {
        content: JSON.stringify({ error: msg }),
        event: { name: "scrape_url", status: "error", summary: msg },
      };
    }
  }

  if (name === "generate_image") {
    const prompt = String(args.prompt || "").trim();
    if (!prompt) {
      return {
        content: JSON.stringify({ error: "prompt required" }),
        event: {
          name: "generate_image",
          status: "error",
          summary: "Missing image prompt",
        },
      };
    }
    const key = opts.xaiKey?.trim();
    if (!key) {
      return {
        content: JSON.stringify({
          error:
            "No XAI_API_KEY — skip the photo or use a CSS/gradient hero. Do not invent a stock-photo URL.",
        }),
        event: {
          name: "generate_image",
          status: "error",
          summary: "No xAI key for Imagine",
        },
      };
    }
    try {
      const url = await generateImagineStill(key, prompt);
      return {
        content: JSON.stringify({
          url,
          usage:
            "Use as <img src={url} alt=... className=\"...\" />. Generated still — not a real staff/site photo.",
        }),
        event: {
          name: "generate_image",
          status: "done",
          summary: "Hero still ready",
          url,
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Image generation failed";
      return {
        content: JSON.stringify({ error: msg }),
        event: { name: "generate_image", status: "error", summary: msg },
      };
    }
  }

  return {
    content: JSON.stringify({ error: `Unknown tool ${name}` }),
    event: {
      name: "scrape_url",
      status: "error",
      summary: `Unknown tool ${name}`,
    },
  };
}

async function generateImagineStill(apiKey: string, prompt: string): Promise<string> {
  const models = ["grok-imagine-image-2.0", "grok-imagine-image"];
  let last = "Image generation failed";
  for (const model of models) {
    const res = await fetch("https://api.x.ai/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: prompt.slice(0, 2000),
        n: 1,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      data?: Array<{ url?: string; b64_json?: string }>;
      error?: { message?: string };
    };
    if (res.ok) {
      const url = data.data?.[0]?.url;
      if (url) return url;
      last = "Imagine returned no URL";
      continue;
    }
    last = data.error?.message || `Imagine ${res.status}`;
  }
  throw new Error(last);
}
