import assert from "node:assert/strict";
import {extractVisibleText} from "./firecrawl";

assert.equal(
  extractVisibleText("<html><body><h1>Apex &amp; Co</h1><script>bad()</script><p>Book now</p></body></html>", null),
  "Apex & Co Book now",
);

assert.equal(
  extractVisibleText("<body>Ignored</body>", "# Markdown wins"),
  "# Markdown wins",
);

console.log("firecrawl text extraction tests passed");
