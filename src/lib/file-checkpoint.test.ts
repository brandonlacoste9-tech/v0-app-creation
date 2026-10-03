/**
 * Run: npx tsx src/lib/file-checkpoint.test.ts
 */
import assert from "node:assert/strict";
import { analyzeSourceTruncation } from "./code-truncation";
import {
  buildContinueRepairPrompt,
  checkpointProgressTitle,
  mergeCheckpointRepair,
  mergedSourceParses,
  nextRepairTarget,
  readTruncatedPaths,
  serializeCheckpoint,
  spliceRepairTail,
  shouldChainCheckpointRepair,
} from "./file-checkpoint";
import { toStreamCompletion, toStreamResult } from "./stream-outcome";
import {
  classifyStreamFiles,
  extractProjectFromResponse,
  parseProject,
  serializeProject,
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
  assert.match(prompt, /Your reply must be ONLY the fenced remainder(?!s)/);
  assert.doesNotMatch(prompt, /already complete/);
}

// Full probe replay: repair re-emits the broken file unchanged -> still
// incomplete, and the byte-identical re-emit is NOT listed as a
// replacement, so the UI toasts honestly instead of claiming success.
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
  assert.deepEqual(merged.replaced, [], "byte-identical re-emit is not a replacement");
  assert.deepEqual(merged.healed, [], "nothing healed");
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

// Chained single-file repair (2026-09-25): with several truncated files the
// prompt targets ONLY the first one — a prompt demanding every remainder at
// once is unanswerable and the model dodges with a prose claim.
{
  const cut1 = "function A() {\n  return (\n    <div>\n";
  const cut2 = "function B() {\n  return (\n    <section>\n";
  const text = fence("src/A.tsx", cut1) + fence("src/B.tsx", cut2) + fence("src/C.tsx", closedA);
  const stored = serializeCheckpoint(classifyStreamFiles(text))!;
  assert.deepEqual(readTruncatedPaths(stored), ["src/A.tsx", "src/B.tsx"]);
  assert.equal(nextRepairTarget(stored), "src/A.tsx");
  const prompt = buildContinueRepairPrompt(stored);
  assert.match(prompt, /FILE src\/A\.tsx — finish this file only/);
  assert.match(prompt, /1 more incomplete file\(s\) after this one: src\/B\.tsx/);
  assert.doesNotMatch(prompt, /FILE src\/B\.tsx — finish this file only/);
  // The second file's body must not be pasted into the prompt.
  assert.doesNotMatch(prompt, /function B\(\)/);
  assert.match(prompt, /Return ONLY the missing remainder/);
  // Explicit target override skips to the named file.
  const promptB = buildContinueRepairPrompt(stored, "src/B.tsx");
  assert.match(promptB, /FILE src\/B\.tsx — finish this file only/);
  assert.doesNotMatch(promptB, /FILE src\/A\.tsx — finish this file only/);
  // After A is repaired, the next target is B.
  const mergedA = mergeCheckpointRepair(stored, fence("src/A.tsx", "    </div>\n  );\n}\n"))!;
  assert.deepEqual(mergedA.replaced, ["src/A.tsx"]);
  assert.deepEqual(mergedA.healed, ["src/A.tsx"], "byte change + file healed");
  assert.equal(nextRepairTarget(mergedA.code), "src/B.tsx");
  const clean = toStreamCompletion(toStreamResult("remainder", "stop", null));
  assert.equal(shouldChainCheckpointRepair(mergedA, 0, 6, clean), true);
  assert.equal(shouldChainCheckpointRepair(mergedA, 6, 6, clean), false, "chain cap still applies");
  for (const reason of ["length", "max_tokens", undefined]) {
    const interrupted = toStreamCompletion(toStreamResult("remainder", reason, null));
    assert.equal(shouldChainCheckpointRepair(mergedA, 0, 6, interrupted), false);
  }
  const cutAgain = mergeCheckpointRepair(stored, fence("src/A.tsx", "      <p>Still building</p>\n", false))!;
  assert.ok(cutAgain.replaced.length > 0, "text changed even though no file finished");
  assert.deepEqual(cutAgain.healed, [], "no file healed, so no chain");
  assert.deepEqual(cutAgain.incomplete, ["src/A.tsx", "src/B.tsx"]);
  assert.equal(shouldChainCheckpointRepair(cutAgain, 0, 6, clean), false, "do not loop on the same incomplete file");
  const noOp = mergeCheckpointRepair(stored, fence("src/A.tsx", cut1))!;
  assert.deepEqual(noOp.replaced, [], "identical output is not a replacement");
  assert.deepEqual(noOp.healed, []);
  assert.equal(shouldChainCheckpointRepair(noOp, 0, 6, clean), false, "no-op repairs cannot auto-chain");
}

// Evidence replay (dead-store guard): a stale truncated entry lists A as
// truncated even though A's body is byte-complete; the repair re-emits A and
// B byte-identical. Under the old code A counted as "replaced" and, with B
// still incomplete, the dead repair re-qualified for another attempt.
{
  const cutB = "function B() {\n  return (\n    <section>\n";
  const stored = serializeProject(
    { "src/A.tsx": closedA, "src/B.tsx": cutB },
    "src/B.tsx",
    ["src/A.tsx", "src/B.tsx"] // stale: A is complete, only B is really cut
  );
  const identical = fence("src/A.tsx", closedA) + fence("src/B.tsx", cutB);
  const merged = mergeCheckpointRepair(stored, identical)!;
  assert.deepEqual(merged.replaced, [], "no bytes changed anywhere");
  assert.deepEqual(merged.healed, []);
  assert.deepEqual(merged.incomplete, ["src/B.tsx"]);
  const clean = toStreamCompletion(toStreamResult("remainder", "stop", null));
  assert.equal(
    shouldChainCheckpointRepair(merged, 0, 12, clean),
    false,
    "identical repair response stops the chain: zero further attempts"
  );
}

// Tail-splice seam preservation (2026-10-03, backlog #2): the old code
// trimmed the head and injected "\n" between head and remainder. A cutoff
// inside `"Hel` with a remainder starting `lo"` spliced into an invalid
// multiline string `"Hel\nlo"` — which the truncation checker still scored
// as complete, so the broken merge was marked healed.
{
  // Evidence case: cutoff mid-string-literal. Seam must join verbatim.
  const head = 'function C() {\n  const label = "Hel';
  const tail = 'lo";\n  return <p>{label}</p>;\n}\n';
  const spliced = spliceRepairTail(head, tail);
  assert.equal(
    spliced,
    'function C() {\n  const label = "Hello";\n  return <p>{label}</p>;\n}\n',
    "no injected newline at the seam: mid-string cutoff splices to valid code"
  );
  assert.equal(
    analyzeSourceTruncation(spliced).likelyTruncated,
    false,
    "truncation checker agrees the evidence case is complete"
  );
  assert.equal(
    mergedSourceParses(spliced),
    true,
    "Babel parses the mid-string splice"
  );

  // Regression guard: the old seam would have produced an invalid
  // multiline string that the truncation checker missed.
  const oldBuggy = head.replace(/\s*$/, "") + "\n" + tail;
  assert.equal(
    analyzeSourceTruncation(oldBuggy).likelyTruncated,
    false,
    "documents the hole: old seam scored complete by the truncation checker"
  );
  assert.equal(
    mergedSourceParses(oldBuggy),
    false,
    "Babel rejects the newline-inside-string splice"
  );

  // Mid-line (not mid-token) cutoff: verbatim join, no forced newline.
  assert.equal(spliceRepairTail("const x = 1;", "const y = 2;"), "const x = 1;const y = 2;");

  // Line-boundary cutoff unchanged: head already ends with a newline.
  assert.equal(
    spliceRepairTail("a\nb\n", "c\nd\n"),
    "a\nb\nc\nd\n"
  );

  // Whitespace at the seam is preserved verbatim (no head trimming).
  assert.equal(
    spliceRepairTail("line1  \nline2   ", "more"),
    "line1  \nline2   more",
    "trailing head whitespace kept exactly"
  );

  // Overlap strip still works and keeps a single line break.
  assert.equal(spliceRepairTail("a\nb\nc", "b\nc\nd"), "a\nb\nc\nd");
  assert.equal(spliceRepairTail("a\nb\nc\n", "b\nc\nd\n"), "a\nb\nc\nd\n");
}

// Merge path: a mid-string cutoff repaired with a remainder must yield
// valid code (healed), and an invalid merged result must stay flagged
// incomplete — never healed.
//
// Note: the base is built with serializeProject (exact head bytes), not the
// unclosed-fence helper — fence() appends a "\n" that would put a newline
// inside the string before the splice even runs.
{
  const cut = 'function Component() {\n  const label = "Hel';
  const base = serializeProject(
    { "src/Component.tsx": cut },
    "src/Component.tsx",
    ["src/Component.tsx"]
  );
  assert.deepEqual(readTruncatedPaths(base), ["src/Component.tsx"]);

  // Good remainder: completes the string literal mid-token.
  const good = mergeCheckpointRepair(
    base,
    fence("src/Component.tsx", 'lo";\n  return <p>{label}</p>;\n}\n')
  )!;
  const goodOut = parseProject(good.code).files["src/Component.tsx"];
  assert.ok(goodOut.includes('"Hello"'), "seam spliced mid-token");
  assert.deepEqual(good.incomplete, [], "valid merge leaves the incomplete list");
  assert.deepEqual(good.healed, ["src/Component.tsx"], "valid merge marked repaired");

  // Bad remainder: `const x =;` is balanced and string-clean, so the
  // truncation checker passes it — but it does not parse. The Babel layer
  // must keep it flagged as incomplete, never healed.
  const badCut = "function Component() {\n  const x =";
  const badBase = serializeProject(
    { "src/Component.tsx": badCut },
    "src/Component.tsx",
    ["src/Component.tsx"]
  );
  const bad = mergeCheckpointRepair(
    badBase,
    fence("src/Component.tsx", ";\n  return <p>Hi</p>;\n}\n")
  )!;
  const badOut = parseProject(bad.code).files["src/Component.tsx"];
  assert.ok(badOut.includes("const x =;"), "seam spliced verbatim");
  assert.equal(
    analyzeSourceTruncation(badOut).likelyTruncated,
    false,
    "truncation checker alone misses this one"
  );
  assert.equal(
    mergedSourceParses(badOut),
    false,
    "Babel rejects the merged result"
  );
  assert.deepEqual(bad.replaced, ["src/Component.tsx"], "bytes changed");
  assert.deepEqual(bad.incomplete, ["src/Component.tsx"], "invalid merge stays flagged");
  assert.deepEqual(bad.healed, [], "invalid merge never marked repaired");
  const clean = toStreamCompletion(toStreamResult("remainder", "stop", null));
  assert.equal(
    shouldChainCheckpointRepair(bad, 0, 6, clean),
    false,
    "no chain off a merge that failed validation"
  );
}
