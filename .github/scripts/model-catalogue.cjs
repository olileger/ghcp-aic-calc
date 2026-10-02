const assert = require("node:assert/strict");
const vm = require("node:vm");

const textFields = ["provider", "model", "status", "category", "tier", "threshold"];
const rateFields = ["input", "cachedInput", "cacheWrite", "output"];
const fields = [...textFields, ...rateFields];
const cataloguePattern = /(?<=const models = )\[[\s\S]*?\](?=;\s*const volumeInputs)/g;

function validateCatalogue(rows) {
  assert(Array.isArray(rows) && rows.length > 0, "The catalogue must be a nonempty array.");
  const identities = new Set();
  return Array.from(rows, (row) => {
    assert(row && typeof row === "object" && !Array.isArray(row), "Invalid model row.");
    assert.deepEqual(Object.keys(row).sort(), [...fields].sort(), "Unexpected or missing model fields.");
    for (const field of textFields) {
      assert(typeof row[field] === "string" && row[field].trim().length > 0,
        `Missing ${field} for a model.`);
      assert(!/[<&\u0000-\u001f\u007f]/.test(row[field]),
        `Unsafe markup or control characters in ${field}.`);
    }
    for (const field of rateFields) {
      assert(row[field] === null || (typeof row[field] === "number"
        && Number.isFinite(row[field]) && row[field] >= 0),
      `Invalid ${field} rate for ${row.model}.`);
    }
    const identity = JSON.stringify([row.provider, row.model, row.tier]);
    assert(!identities.has(identity), `Duplicate provider/model/tier: ${identity}.`);
    identities.add(identity);
    return Object.fromEntries(fields.map((field) => [field, row[field]]));
  });
}

function readCatalogue(html) {
  const matches = [...html.matchAll(cataloguePattern)];
  assert.equal(matches.length, 1, "Cannot identify exactly one existing model catalogue.");
  return validateCatalogue(vm.runInNewContext(matches[0][0], {}, { timeout: 1000 }));
}

function validateCalculator(html) {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  assert(scripts.length > 0, "No calculator scripts found.");
  for (const [, script] of scripts) new vm.Script(script);
  const match = html.match(/function calculateTotal\(model, volumes, share\) \{[\s\S]*?\n    \}/);
  assert(match, "Cannot locate the calculator's arithmetic function.");
  const calculateTotal = vm.runInNewContext(`(${match[0]})`, {}, { timeout: 1000 });
  const base = { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 10 };
  const cases = [
    [[0, 0, 0, 0], 100, 2.5, 0],
    [[1, 0, 0, 0], 100, 2.5, 2],
    [[0, 1, 0, 0], 100, 2.5, 0.2],
    [[0, 0, 1, 0], 100, 2.5, 2.5],
    [[0, 0, 0, 1], 100, 2.5, 10],
    [[1, 3, 3, 4], 100, 2.5, 50.1],
    [[1, 3, 3, 4], 50, 2.5, 25.05],
    [[1, 3, 3, 4], 12.5, 2.5, 6.2625],
    [[1, 3, 3, 4], 0, 2.5, 0],
    [[1, 3, 3, 4], 100, null, 42.6],
    [[1, 3, 3, 4], 100, 0, 42.6],
    [[0.000001, 0, 0, 0], 100, 2.5, 0.000002]
  ];
  for (const [volumes, share, cacheWrite, expected] of cases) {
    const inputs = Object.fromEntries(rateFields.map((field, index) => [field, volumes[index]]));
    const actual = calculateTotal({ ...base, cacheWrite }, inputs, share);
    assert(Math.abs(actual - expected) <= 1e-9, "Calculator arithmetic regression.");
  }
  const conversions = html.match(/(?:total|first\.total|second\.total|model\.total) \/ 0\.01/g);
  assert.equal(conversions?.length, 4, "The AI Credit conversion needs manual review.");
}

function prepareUpdate(html, proposedRows) {
  const existing = readCatalogue(html);
  const proposed = validateCatalogue(proposedRows);
  validateCalculator(html);
  if (JSON.stringify(existing) === JSON.stringify(proposed)) {
    return { changed: false, html, count: proposed.length };
  }
  const newline = html.includes("\r\n") ? "\r\n" : "\n";
  const replacement = `[${newline}${proposed.map((row) =>
    `      ${JSON.stringify(row).replace(/</g, "\\u003c")}`).join(`,${newline}`)}${newline}    ]`;
  const updated = html.replace(cataloguePattern, () => replacement);
  validateCalculator(updated);
  assert.deepEqual(readCatalogue(updated), proposed, "Catalogue serialization changed the data.");
  assert.equal(updated.replace(cataloguePattern, "[]"), html.replace(cataloguePattern, "[]"),
    "An update would modify code outside the catalogue.");
  return { changed: true, html: updated, count: proposed.length };
}

module.exports = { readCatalogue, validateCatalogue, validateCalculator, prepareUpdate };
