import assert from "node:assert/strict";
import {
  assertPublicHttpUrl,
  extractUrlsFromText,
  parsePageHtml,
} from "./fetch-page";

assert.throws(() => assertPublicHttpUrl("http://localhost/admin"));
assert.throws(() => assertPublicHttpUrl("http://127.0.0.1/"));
assert.throws(() => assertPublicHttpUrl("http://192.168.1.8/"));
assert.throws(() => assertPublicHttpUrl("ftp://example.com"));
assert.equal(
  assertPublicHttpUrl("https://wintersummersolutions.ca/").hostname,
  "wintersummersolutions.ca"
);

const urls = extractUrlsFromText(
  "Rebuild https://greenguylawn.com/en and also http://127.0.0.1/secret"
);
assert.deepEqual(urls, ["https://greenguylawn.com/en"]);

const html = `<!doctype html><html><head>
<title>Winter Summer Solutions</title>
<meta name="description" content="Landscaping in Petawawa.">
</head><body>
<h1>Lawn care done right</h1>
<a href="mailto:info@wintersummersolutions.ca">Email</a>
<a href="tel:6136870444">Call</a>
<p>Hours Monday–Friday 8–6. Call (613) 687-0444.</p>
<button>Get a quote</button>
</body></html>`;

const facts = parsePageHtml("https://wintersummersolutions.ca/", html);
assert.equal(facts.title, "Winter Summer Solutions");
assert.ok(facts.emails.includes("info@wintersummersolutions.ca"));
assert.ok(facts.headings.some((h) => /Lawn care/i.test(h)));
assert.ok(facts.phones.length >= 1);
assert.ok(facts.ctas.includes("Get a quote"));

console.log("fetch-page ok");
