/**
 * Run: npx tsx src/lib/iteration-diff.test.ts
 */
import {
  collapseContext,
  compareVersionCodes,
  diffLines,
  impactHintForPath,
  pickDefaultDiffPath,
} from "./iteration-diff";

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

// line diff basics
{
  const lines = diffLines("a\nb\nc", "a\nx\nc");
  const kinds = lines.map((l) => l.kind).join(",");
  assert(kinds.includes("del") && kinds.includes("add"), "detect change");
  assert(lines.some((l) => l.kind === "context" && l.text === "a"), "keep context a");
  assert(lines.some((l) => l.kind === "del" && l.text === "b"), "del b");
  assert(lines.some((l) => l.kind === "add" && l.text === "x"), "add x");
}

// impact hints
{
  assert(impactHintForPath("app/actions.ts").includes("actions"), "actions hint");
  assert(impactHintForPath("app/page.tsx").includes("route"), "route hint");
  assert(impactHintForPath("components/Component.tsx").includes("ui"), "ui hint");
}

// multi-file version compare (Admin → Continue add roles style)
{
  const base = JSON.stringify({
    v: 1,
    entry: "src/Component.tsx",
    files: {
      "src/Component.tsx": `function Component() {
  return <div>Users</div>;
}
`,
      "src/UserTable.tsx": `function UserTable() {
  return <table />;
}
`,
    },
  });
  const head = JSON.stringify({
    v: 1,
    entry: "src/Component.tsx",
    files: {
      "src/Component.tsx": `function Component() {
  return <div>Users + roles</div>;
}
`,
      "src/UserTable.tsx": `function UserTable() {
  return <table><th>Role</th></table>;
}
`,
      "app/actions.ts": `export async function listUsers() { return []; }
export async function setRole() { return { ok: true }; }
`,
    },
  });
  const report = compareVersionCodes(base, head, {
    baseLabel: "v1",
    headLabel: "v2",
  });
  assert(report.hasChanges, "has changes");
  assert(report.changedFiles.length >= 2, "multiple files");
  const added = report.changedFiles.find((f) => f.path === "app/actions.ts");
  assert(added?.kind === "added", "actions added");
  assert(added!.impact.includes("actions"), "actions impact");
  const mod = report.changedFiles.find((f) => f.path === "src/Component.tsx");
  assert(mod?.kind === "modified", "component modified");
  const def = pickDefaultDiffPath(report);
  assert(def, "default path");
  assert(report.totalAdditions > 0, "additions counted");
}

// no change
{
  const code = `function Component() { return <div/>; }`;
  const report = compareVersionCodes(code, code);
  assert(!report.hasChanges, "identical = no changes");
  assert(pickDefaultDiffPath(report) === null, "no default");
}

// collapse context
{
  const many = Array.from({ length: 40 }, (_, i) => `line ${i}`).join("\n");
  const next = many.replace("line 20", "line 20 CHANGED");
  const lines = diffLines(many, next);
  const collapsed = collapseContext(lines, 2);
  assert(collapsed.length < lines.length, "collapse shortens");
  assert(
    collapsed.some((l) => l.text.includes("unchanged lines")),
    "ellipsis marker"
  );
}

// Kanban-style single file iteration
{
  const v1 = `function Component() {
  const cols = ["Backlog", "Doing"];
  return <div>{cols.join()}</div>;
}
`;
  const v2 = `function Component() {
  const cols = ["Backlog", "Doing", "Done"];
  return <div className="kanban">{cols.join()}</div>;
}
`;
  const report = compareVersionCodes(v1, v2, {
    baseLabel: "v1",
    headLabel: "v2 Continue",
  });
  assert(report.hasChanges, "kanban has changes");
  assert(report.changedFiles[0].kind === "modified", "single file mod");
}

console.log("iteration-diff tests: all passed");
