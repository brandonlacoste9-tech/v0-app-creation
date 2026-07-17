/**
 * Run: npx tsx src/lib/byob/preview-intercept.test.ts
 */
import type { DatabaseSchemaMap } from "./types";
import {
  applyPreviewActionIntercept,
  generatePreviewActionsInline,
  sourceReferencesActions,
  stripActionImportDeclarations,
} from "./preview-intercept";
import { wrapCodeForPreview } from "../preview-html";
import { PREVIEW_THEMES } from "../types";

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
          defaultValue: null,
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

const prodUi = `import { listUsers, createUsers } from "@/app/actions";

function Component() {
  const [rows, setRows] = useState([]);
  useEffect(() => {
    listUsers().then(setRows);
  }, []);
  return (
    <div className="p-8">
      <button type="button" onClick={() => createUsers({ email: "a@b.com" })}>
        Add
      </button>
      <pre>{JSON.stringify(rows)}</pre>
    </div>
  );
}
`;

{
  assert(sourceReferencesActions(prodUi), "detects actions import");
  const stripped = stripActionImportDeclarations(prodUi);
  assert(!stripped.includes("@/app/actions"), "import removed");
  assert(stripped.includes("function Component"), "component kept");
}

{
  const inline = generatePreviewActionsInline(schema);
  assert(inline.includes("async function listUsers"), "listUsers");
  assert(inline.includes("async function createUsers"), "createUsers");
  assert(inline.includes("__previewDb"), "db store");
}

{
  const { code, intercepted } = applyPreviewActionIntercept(prodUi, schema);
  assert(intercepted, "intercepted");
  assert(code.includes("async function listUsers"), "inlined list");
  assert(!code.includes('from "@/app/actions"'), "no production import");
  assert(code.includes("function Component"), "component present");
}

{
  const html = wrapCodeForPreview(prodUi, PREVIEW_THEMES[0], "{}", {
    byobSchema: schema,
  });
  assert(html.includes("listUsers") || html.includes("__previewDb"), "html has intercept");
  assert(html.includes("shipboard-preview-actions-intercept") || html.includes("preview-actions"), "babel plugin");
  assert(html.includes("function Component") || html.includes("Component"), "component in html");
}

console.log("preview-intercept tests: all passed");
