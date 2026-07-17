/**
 * Run: npx tsx src/lib/byob/agent-codegen.test.ts
 */
import type { DatabaseSchemaMap } from "./types";
import {
  buildAgentShipFiles,
  generateAgentChatRouteTs,
  generateAgentDbToolsTs,
  generateCustomToolsTs,
} from "./agent-codegen";
import { buildShipProjectFiles } from "../github-project";
import type { CustomAgentTool } from "./agent-types";

function assert(c: boolean, m: string) {
  if (!c) throw new Error(m);
}

const schema: DatabaseSchemaMap = {
  v: 1,
  dialect: "postgresql",
  provider: "neon",
  introspectedAt: "2026-01-01T00:00:00.000Z",
  tableCount: 1,
  tables: [
    {
      name: "users",
      columns: [
        {
          name: "id",
          dataType: "uuid",
          udtName: "uuid",
          nullable: false,
          isPrimaryKey: true,
          defaultValue: "gen_random_uuid()",
          maxLength: null,
        },
        {
          name: "email",
          dataType: "text",
          udtName: "text",
          nullable: false,
          isPrimaryKey: false,
          defaultValue: null,
          maxLength: null,
        },
      ],
      foreignKeys: [],
    },
  ],
};

const custom: CustomAgentTool[] = [
  {
    id: "1",
    name: "fetchWeather",
    description: "Get weather for a city",
    parameters: [
      { name: "city", type: "string", required: true, description: "City name" },
    ],
    executeBody: `return { city: args.city, tempC: 20 };`,
    enabled: true,
  },
];

{
  const tools = generateAgentDbToolsTs(schema);
  assert(tools.includes('from "ai"') || tools.includes("from 'ai'"), "ai sdk");
  assert(tools.includes("listUsers"), "listUsers tool");
  assert(tools.includes("createUsers"), "createUsers tool");
  assert(tools.includes("insertUsersSchema"), "zod schema param");
  assert(tools.includes("from \"@/app/actions\""), "actions import");
}

{
  const customTs = generateCustomToolsTs(custom);
  assert(customTs.includes("fetchWeather"), "custom tool name");
  assert(customTs.includes("Get weather"), "description");
  assert(customTs.includes("args.city"), "execute body");
}

{
  const route = generateAgentChatRouteTs({ hasDbTools: true, hasCustomTools: true });
  assert(route.includes("streamText"), "streamText");
  assert(route.includes("dbTools"), "dbTools");
  assert(route.includes("customTools"), "customTools");
  assert(route.includes("maxSteps"), "maxSteps");
}

{
  const files = buildAgentShipFiles({ schema, customTools: custom });
  const paths = files.map((f) => f.path);
  assert(paths.includes("lib/agent/tools.ts"), "tools");
  assert(paths.includes("lib/agent/customTools.ts"), "custom");
  assert(paths.includes("app/api/chat/route.ts"), "route");
}

{
  const ship = buildShipProjectFiles({
    code: `function Component(){return <div className="p-4">Hi</div>}`,
    title: "Agent Demo",
    stack: "next",
    byobSchema: schema,
    customTools: custom,
  });
  assert(ship.some((f) => f.path === "lib/agent/tools.ts"), "ship tools");
  assert(ship.some((f) => f.path === "lib/agent/customTools.ts"), "ship custom");
  assert(ship.some((f) => f.path === "app/api/chat/route.ts"), "ship agent route");
  const pkg = JSON.parse(ship.find((f) => f.path === "package.json")!.content);
  assert(pkg.dependencies.ai, "ai dep");
  assert(pkg.dependencies["@ai-sdk/openai"], "openai sdk");
  const customFile = ship.find((f) => f.path === "lib/agent/customTools.ts")!.content;
  assert(customFile.includes("fetchWeather"), "custom in ship");
}

console.log("agent-codegen tests: all passed");
