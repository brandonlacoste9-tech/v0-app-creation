/**
 * Run: npx tsx src/lib/file-checkpoint.test.ts
 */
import assert from "node:assert/strict";
import { analyzeSourceTruncation } from "./code-truncation";
import {
  buildContinueRepairPrompt,
  checkpointProgressTitle,
  mergeCheckpointRepair,
  readTruncatedPaths,
  serializeCheckpoint,
  spliceRepairTail,
} from "./file-checkpoint";
import {
  classifyStreamFiles,
  extractProjectFromResponse,
  parseProject,
  splitTrailingProse,
} from "./project-files";

const closedA = `function A() {\n  return <p>Keep</p>;\n}\n`;
const closedB = `function B() {\n  return <p>Bottle</p>;\n}\n`;

function fence(path: string, body: string, close = true): string {
  return "```tsx file=\"" + path + "\"\n" + body.replace(/\n$/, "") + (close ? "\n```\n" : "\n");
}

{
  const text = "No fences here, just a plan for a store.";
  const c = classifyStreamFiles(text);
  assert.equal(c.hadFence, false);
  assert.equal(Object.keys(c.complete).length, 0);
  assert.equal(c.inProgress, null);
  const extracted = extractProjectFromResponse(text);
  assert.equal(extracted.project.files["src/Component.tsx"], "");
}

{
  const prose = "\n\nHere is the explanation that must stay out of the file.";
  const text = fence("src/B.tsx", "function B() {\n  return <div>\n", false) + prose;
  const c = classifyStreamFiles(text);
  assert.equal(Object.keys(c.complete).length, 0);
  assert.ok(c.inProgress);
  assert.equal(c.inProgress?.path, "src/B.tsx");
  assert.ok(!c.inProgress!.body.includes("explanation"), "prose not swallowed");
  assert.ok(c.inProgress!.body.includes("return <div>"), "partial code kept");
  assert.ok(!c.inProgress!.body.includes("}"), "no invented closer");
  const split = splitTrailingProse("function B() {\n  return <div>\n\nHere is the explanation that must stay out of the file.");
  assert.ok(!split.code.includes("explanation"));
}

{
  const text =
    fence("src/A.tsx", closedA) +
    fence("src/B.tsx", "function B() {\n  return <div>\n", false);
  const c = classifyStreamFiles(text);
  assert.equal(c.complete["src/A.tsx"], closedA);
  assert.equal(c.inProgress?.path, "src/B.tsx");
  assert.ok(!c.complete["src/B.tsx"], "open tail is not complete");
  const stored = serializeCheckpoint(c)!;
  const parsed = parseProject(stored);
  assert.equal(parsed.files["src/A.tsx"], closedA, "checkpoint bytes");
  assert.deepEqual(readTruncatedPaths(stored), ["src/B.tsx"]);
  assert.ok(parsed.files["src/B.tsx"].includes("return <div>"));
}

{
  const text = fence("src/A.tsx", "function A() {\n  return <p>First</p>;\n}\n") + fence("src/A.tsx", closedA);
  const c = classifyStreamFiles(text);
  assert.equal(c.complete["src/A.tsx"], closedA, "later closed fence wins");
  assert.deepEqual(c.duplicatePaths, ["src/A.tsx"]);
  const openRewrite =
    fence("src/A.tsx", closedA) + fence("src/A.tsx", "function A() {\n  return <p>Nope", false);
  const again = classifyStreamFiles(openRewrite);
  assert.equal(again.complete["src/A.tsx"], closedA, "open rewrite does not clobber");
  assert.equal(again.inProgress?.path, "src/A.tsx");
  const snap = serializeCheckpoint(again)!;
  assert.equal(parseProject(snap).files["src/A.tsx"], closedA);
  assert.deepEqual(readTruncatedPaths(snap), []);
}

{
  const text = "Intro.\n" + fence("src/Hero.tsx", "export function Hero() {\n  return <h1>Hi</h1>;\n}\n") + fence("src/Component.tsx", "function Component() {\n  return <Hero />;\n}\n");
  const extracted = extractProjectFromResponse(text);
  assert.equal(extracted.summary, "Intro.");
  assert.ok(extracted.isMulti);
  assert.equal(extracted.project.entry, "src/Component.tsx");
  assert.match(extracted.project.files["src/Hero.tsx"], /function Hero/);
}

{
  const base = serializeCheckpoint(
    classifyStreamFiles(fence("src/A.tsx", closedA) + fence("src/B.tsx", "function B() {\n  return <div>\n", false))
  )!;
  assert.equal(parseProject(base).files["src/A.tsx"], closedA);
  const model =
    fence("src/A.tsx", "function A() {\n  return <p>REWRITTEN</p>;\n}\n") +
    fence("src/B.tsx", closedB) +
    fence("src/C.tsx", "function C() {\n  return <p>Extra</p>;\n}\n");
  const merged = mergeCheckpointRepair(base, model);
  assert.ok(merged);
  const files = parseProject(merged!.code).files;
  assert.equal(files["src/A.tsx"], closedA, "checkpointed file byte-identical");
  assert.equal(files["src/B.tsx"], closedB, "incomplete file replaced");
  assert.equal(files["src/C.tsx"], undefined, "extra file ignored");
  assert.deepEqual(merged!.incomplete, []);
  assert.deepEqual(merged!.replaced, ["src/B.tsx"]);
  assert.equal(analyzeSourceTruncation(files["src/B.tsx"]).likelyTruncated, false);
}

{
  const base = serializeCheckpoint(
    classifyStreamFiles(fence("src/A.tsx", closedA) + fence("src/B.tsx", "function B() {\n  return <div>\n", false))
  )!;
  const stillOpen = fence("src/B.tsx", "function B() {\n  return <section>\n", false) + "\nHope this helps you ship.";
  const merged = mergeCheckpointRepair(base, stillOpen)!;
  assert.deepEqual(merged.incomplete, ["src/B.tsx"]);
  assert.equal(parseProject(merged.code).files["src/A.tsx"], closedA);
  assert.ok(parseProject(merged.code).files["src/B.tsx"].includes("<section>"));
  assert.ok(!parseProject(merged.code).files["src/B.tsx"].includes("Hope this"));
  const prompt = buildContinueRepairPrompt(base);
  assert.match(prompt, /ONLY the missing remainder/);
  assert.match(prompt, /src\/B\.tsx/);
  assert.doesNotMatch(prompt, /src\/A\.tsx/);
}

{
  assert.equal(mergeCheckpointRepair("function Component() { return <p/>; }", "```tsx\nfunction Component(){return <p/>;}\n```"), null);
}

{
  const keep = {
    "src/A.tsx": "function A() {\n  return <p>A</p>;\n}\n",
    "src/B.tsx": "function B() {\n  return <p>B</p>;\n}\n",
    "src/C.tsx": "function C() {\n  return <p>C</p>;\n}\n",
  };
  const killed =
    fence("src/A.tsx", keep["src/A.tsx"]) +
    fence("src/B.tsx", keep["src/B.tsx"]) +
    fence("src/C.tsx", keep["src/C.tsx"]) +
    fence("src/D.tsx", "function D() {\n  return <section>\n", false);
  const stored = serializeCheckpoint(classifyStreamFiles(killed))!;
  assert.equal(checkpointProgressTitle(stored), "3 of 4 files — truncated");
  for (const path of Object.keys(keep)) {
    assert.equal(parseProject(stored).files[path], keep[path], path + " durable");
  }
  assert.deepEqual(readTruncatedPaths(stored), ["src/D.tsx"]);
  const prompt = buildContinueRepairPrompt(stored);
  assert.match(prompt, /src\/D\.tsx/);
  assert.doesNotMatch(prompt, /function A/);
  const finished = "function D() {\n  return <section><p>Done</p></section>;\n}\n";
  const merged = mergeCheckpointRepair(
    stored,
    fence("src/A.tsx", "function A() {\n  return <p>REWRITTEN</p>;\n}\n") + fence("src/D.tsx", finished)
  )!;
  const files = parseProject(merged.code).files;
  assert.equal(files["src/A.tsx"], keep["src/A.tsx"]);
  assert.equal(files["src/B.tsx"], keep["src/B.tsx"]);
  assert.equal(files["src/C.tsx"], keep["src/C.tsx"]);
  assert.equal(files["src/D.tsx"], finished);
  assert.deepEqual(merged.incomplete, []);
  assert.deepEqual(merged.replaced, ["src/D.tsx"]);
}

{
  const base = serializeCheckpoint(
    classifyStreamFiles(fence("src/A.tsx", closedA) + fence("src/B.tsx", "function B() {\n  return <div>\n", false))
  )!;
  const closedCut = "function B() {\n  return (\n    <div>\n";
  assert.equal(analyzeSourceTruncation(closedCut).likelyTruncated, true);
  const merged = mergeCheckpointRepair(base, fence("src/B.tsx", closedCut))!;
  assert.deepEqual(merged.incomplete, ["src/B.tsx"], "closed fence can still be incomplete");
  assert.deepEqual(merged.replaced, ["src/B.tsx"]);
  assert.equal(parseProject(merged.code).files["src/A.tsx"], closedA);
  assert.equal(checkpointProgressTitle(merged.code), "1 of 2 files — truncated");
}

// Probe regression (2026-09-24): fences closed but the last file's JSX left
// open — the classifier used to mark every file "complete", starving the
// Continue-repair machinery of a named target.
{
  const healthy = "function Footer() {\n  return <footer><p>Hi</p></footer>;\n}\n";
  const cutJsx =
    "function Component() {\n" +
    "  return (\n" +
    "    <div className=\"wrap\">\n" +
    "      <h1>Harbor Goods</h1>\n";
  const text = fence("src/Footer.tsx", healthy) + fence("src/Component.tsx", cutJsx);
  const extracted = extractProjectFromResponse(text);
  assert.deepEqual(extracted.project.truncated, ["src/Component.tsx"]);
  assert.equal(extracted.project.files["src/Footer.tsx"], healthy);
}

// Healthy multi-file output must not be flagged.
{
  const text = fence("src/A.tsx", closedA) + fence("src/B.tsx", closedB);
  const extracted = extractProjectFromResponse(text);
  assert.equal(extracted.project.truncated, undefined);
}

// The repair prompt names the checker's diagnosis so the model cannot
// misjudge the file as complete.
{
  const cutJsx =
    "function Component() {\n  return (\n    <div>\n      <h1>Hi</h1>\n";
  const text = fence("src/Footer.tsx", closedA) + fence("src/Component.tsx", cutJsx);
  const { project } = extractProjectFromResponse(text);
  const stored = JSON.stringify({ v: 1, entry: "src/Component.tsx", files: project.files, truncated: project.truncated, __ADGEN_PROJECT_V1__: true });
  const prompt = buildContinueRepairPrompt(stored);
  assert.match(prompt, /ONLY the missing remainder/);
  assert.match(prompt, /src\/Component\.tsx/);
  assert.match(prompt, /unclosed JSX/);
  assert.doesNotMatch(prompt, /src\/Footer\.tsx/);
  assert.match(prompt, /OUTPUT OVERRIDE for this repair: skip PLAN and SUMMARY entirely/);
  assert.match(prompt, /Your reply must be ONLY the fenced remainder\(s\)/);
  assert.doesNotMatch(prompt, /already complete/);
}

// Full probe replay: repair re-emits the broken file unchanged -> still
// incomplete, so the UI can toast honestly instead of claiming success.
{
  const cutJsx =
    "function Component() {\n  return (\n    <div>\n      <h1>Hi</h1>\n";
  const v1 = extractProjectFromResponse(
    fence("src/Footer.tsx", closedA) + fence("src/Component.tsx", cutJsx)
  ).project;
  const stored = JSON.stringify({ v: 1, entry: "src/Component.tsx", files: v1.files, truncated: v1.truncated, __ADGEN_PROJECT_V1__: true });
  assert.deepEqual(readTruncatedPaths(stored), ["src/Component.tsx"]);
  const merged = mergeCheckpointRepair(
    stored,
    fence("src/Footer.tsx", closedA) + fence("src/Component.tsx", cutJsx)
  )!;
  assert.deepEqual(merged.incomplete, ["src/Component.tsx"], "unchanged re-emit stays incomplete");
  assert.deepEqual(merged.replaced, ["src/Component.tsx"]);
  assert.equal(parseProject(merged.code).files["src/Footer.tsx"], closedA);
}

// Tail-splice unit tests: the repair prompt asks for ONLY the missing
// remainder, so the merge appends instead of requiring a whole-file
// re-emission (a 400-line re-emit is what kept truncating the repair itself).
{
  const head = "function B() {\n  return (\n    <div>\n";
  const tail = "      <p>Done</p>\n    </div>\n  );\n}\n";
  const spliced = spliceRepairTail(head, tail);
  assert.equal(spliced, "function B() {\n  return (\n    <div>\n      <p>Done</p>\n    </div>\n  );\n}\n");
  assert.equal(analyzeSourceTruncation(spliced).likelyTruncated, false);

  // Model echoes the last lines it saw: the seam is de-duplicated.
  const echoed = spliceRepairTail("a\nb\nc\n", "b\nc\nd\n");
  assert.equal(echoed, "a\nb\nc\nd\n");

  // Model re-emits the whole file anyway: fall back to whole-file replace.
  const whole = "function B() {\n  return <p>Rewritten</p>;\n}\n";
  assert.equal(spliceRepairTail(head, whole), whole);

  // Never invents closers: output is head + verbatim tail, nothing more.
  assert.ok(!spliced.includes("Hope this"));
}

// Merge path: a genuine remainder completes the file without a re-emit.
{
  const cutB = "function B() {\n  return (\n    <div>\n      <h1>Hi</h1>\n";
  const base = serializeCheckpoint(
    classifyStreamFiles(fence("src/A.tsx", closedA) + fence("src/B.tsx", cutB, false))
  )!;
  assert.deepEqual(readTruncatedPaths(base), ["src/B.tsx"]);
  const remainder = "      <p>Bye</p>\n    </div>\n  );\n}\n";
  const merged = mergeCheckpointRepair(base, fence("src/B.tsx", remainder))!;
  const files = parseProject(merged.code).files;
  assert.ok(files["src/B.tsx"].includes("<h1>Hi</h1>"), "checkpointed head kept");
  assert.ok(files["src/B.tsx"].includes("<p>Bye</p>"), "remainder appended");
  assert.equal(files["src/B.tsx"].split("function B()").length - 1, 1, "no duplicated head");
  assert.deepEqual(merged.incomplete, [], "file now complete");
  assert.deepEqual(merged.replaced, ["src/B.tsx"]);
  assert.equal(files["src/A.tsx"], closedA, "checkpointed file byte-identical");
}

// Nike-store replay: truncated Component.tsx with unclosed JSX + the missing
// tail -> spliced file passes the truncation checker, preview can compile.
{
  const cutJsx =
    "function Component() {\n" +
    "  return (\n" +
    "    <div className=\"wrap\">\n" +
    "      <h1>Shoe Store</h1>\n" +
    "      <ProductDetail product={selected} onClose={() => setSelected(null)} />\n";
  const v1 = extractProjectFromResponse(
    fence("src/Footer.tsx", closedA) + fence("src/Component.tsx", cutJsx)
  ).project;
  const stored = JSON.stringify({ v: 1, entry: "src/Component.tsx", files: v1.files, truncated: v1.truncated, __ADGEN_PROJECT_V1__: true });
  assert.deepEqual(readTruncatedPaths(stored), ["src/Component.tsx"]);
  const tail = "    </div>\n  );\n}\n";
  const merged = mergeCheckpointRepair(stored, fence("src/Component.tsx", tail))!;
  assert.deepEqual(merged.incomplete, [], "repair completes the file");
  const out = parseProject(merged.code).files["src/Component.tsx"];
  assert.ok(out.includes("<h1>Shoe Store</h1>"));
  assert.ok(out.endsWith("}\n"));
  assert.equal(analyzeSourceTruncation(out).likelyTruncated, false);
}

console.log("file-checkpoint tests: all passed");

