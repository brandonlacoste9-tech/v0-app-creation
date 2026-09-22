import assert from "node:assert/strict";
import { deriveShortTitle, displayGalleryTitle } from "./gallery-title";

assert.equal(
  deriveShortTitle(
    "Create a ChatGPT-style app shell: left chat history sidebar, main message list"
  ),
  "AI Chat UI"
);

assert.equal(
  displayGalleryTitle(
    "Create a ChatGPT-style app shell: left chat histor..."
  ),
  "AI Chat UI"
);

assert.equal(deriveShortTitle("Admin Users"), "Admin Users");

const clamped = deriveShortTitle(
  "A very long original storefront name that should wrap at a word boundary without cutting mid-word xyzzy"
);
assert.ok(clamped.length <= 48, "clamped length");
assert.ok(!clamped.includes("xyzzy"), "did not keep overflow token");
assert.ok(!clamped.endsWith(" "), "no trailing space");
assert.ok(!/\w$/.test(clamped) || !clamped.endsWith("mid-"), "word boundary");

assert.equal(deriveShortTitle("   "), "Untitled");
assert.equal(displayGalleryTitle("Northline Supply"), "Northline Supply");

console.log("gallery-title tests: all passed");
