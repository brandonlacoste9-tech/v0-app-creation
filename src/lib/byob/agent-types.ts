/**
 * Phase C — Sovereign Tool Bus: custom tool definitions (client-safe).
 */

export type CustomToolParamType = "string" | "number" | "boolean";

export interface CustomToolParameter {
  name: string;
  type: CustomToolParamType;
  required: boolean;
  description?: string;
}

/** User-defined tool — compiled into lib/agent/customTools.ts on ship */
export interface CustomAgentTool {
  id: string;
  /** Valid JS identifier, e.g. fetchWeather */
  name: string;
  description: string;
  parameters: CustomToolParameter[];
  /**
   * Body of the execute function (without the function wrapper).
   * Receives `args` (parsed params). Must return a JSON-serializable value.
   * Example: `const res = await fetch(...); return res.json();`
   */
  executeBody: string;
  enabled: boolean;
}

export function isValidToolName(name: string): boolean {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) && name.length <= 64;
}

export function emptyCustomTool(): CustomAgentTool {
  return {
    id: crypto.randomUUID?.() ?? `tool-${Date.now()}`,
    name: "fetchExample",
    description: "Describe what this tool does for the agent.",
    parameters: [
      {
        name: "query",
        type: "string",
        required: true,
        description: "Search or input string",
      },
    ],
    executeBody: `// TODO: implement — this runs on the server in the ejected app
return { ok: true, query: args.query, note: "Replace with real fetch logic" };`,
    enabled: true,
  };
}
