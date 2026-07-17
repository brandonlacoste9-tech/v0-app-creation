/**
 * CLI: npx tsx src/cli-scrape.ts https://example.com
 */
import { scrapeInspiration } from "./scrape.js";

const url = process.argv[2];
if (!url) {
  console.error("Usage: tsx src/cli-scrape.ts <url> [--screenshot]");
  process.exit(1);
}

const result = await scrapeInspiration({
  url,
  screenshot: process.argv.includes("--screenshot"),
});
console.log(JSON.stringify(result, null, 2));
