const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readCatalogue, prepareUpdate, validateCatalogue } = require("./model-catalogue.cjs");

const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
const baseline = readCatalogue(html);
const copy = () => structuredClone(baseline);

test("unchanged catalogue preserves the original file byte for byte", () => {
  assert.deepEqual(prepareUpdate(html, copy()), {
    changed: false, html, count: baseline.length
  });
});

test("verified additions, removals, rates and tiers only change the catalogue", () => {
  const proposed = copy().slice(1);
  proposed[0].input = 3;
  proposed.push({
    ...baseline[0], model: "Synthetic model", tier: "Long context",
    threshold: "> 200K", cacheWrite: 0
  });
  const update = prepareUpdate(html, proposed);
  assert.equal(update.changed, true);
  assert.deepEqual(readCatalogue(update.html), proposed);
  const pattern = /(?<=const models = )\[[\s\S]*?\](?=;\s*const volumeInputs)/g;
  assert.equal(update.html.replace(pattern, "[]"), html.replace(pattern, "[]"));
});

test("preserves unsupported and supported free rates distinctly", () => {
  const proposed = copy();
  proposed[0].cacheWrite = 0;
  proposed[1].cacheWrite = null;
  const actual = readCatalogue(prepareUpdate(html, proposed).html);
  assert.equal(actual[0].cacheWrite, 0);
  assert.equal(actual[1].cacheWrite, null);
});

test("preserves CRLF line endings", () => {
  const windowsHtml = html.replace(/\r?\n/g, "\r\n");
  const proposed = copy();
  proposed[0].input += 1;
  const update = prepareUpdate(windowsHtml, proposed);
  assert(!/(?<!\r)\n/.test(update.html));
});

test("rejects incomplete, duplicate, invalid and unsafe catalogues", () => {
  assert.throws(() => validateCatalogue([]), /nonempty/);
  for (const value of [undefined, -1, NaN, Infinity, "2"]) {
    const proposed = copy();
    proposed[0].input = value;
    assert.throws(() => prepareUpdate(html, proposed), /Invalid input rate/);
  }
  const missing = copy();
  delete missing[0].threshold;
  assert.throws(() => prepareUpdate(html, missing), /missing model fields/);
  const extra = copy();
  extra[0].unexpected = true;
  assert.throws(() => prepareUpdate(html, extra), /Unexpected/);
  assert.throws(() => prepareUpdate(html, [...copy(), baseline[0]]), /Duplicate/);
  for (const model of ["", "<img src=x onerror=alert(1)>", "A &lt;script", "A\nB"]) {
    const proposed = copy();
    proposed[0].model = model;
    assert.throws(() => prepareUpdate(html, proposed), /Missing model|Unsafe/);
  }
});

test("fails closed on changed catalogue structure, syntax, arithmetic or conversion", () => {
  assert.throws(() => prepareUpdate(html.replace("const models =", "const catalogue ="), copy()),
    /exactly one/);
  assert.throws(() => prepareUpdate(html.replace("const modelShares =", "const modelShares = ="), copy()),
    SyntaxError);
  assert.throws(() => prepareUpdate(html.replace("const factor = share / 100;", "const factor = share / 10;"), copy()),
    /arithmetic regression/);
  assert.throws(() => prepareUpdate(html.replaceAll("/ 0.01", "/ 0.02"), copy()),
    /conversion needs manual review/);
});

const workflowSource = fs.readFileSync(
  path.join(__dirname, "..", "workflows", "update-copilot-models.md"), "utf8")
  .replace(/\r\n/g, "\n");

test("source retrieval runs deterministically before the agent without retries", () => {
  assert.match(workflowSource, /tools:\n  bash: \["node:\*"\]\nsteps:/);
  assert.match(workflowSource, /network:\n  allowed:\n    - defaults\ntools:/);
  const command = workflowSource.match(
    /  - name: Download official Copilot pricing\n    shell: bash\n    run: \|\n([\s\S]*?)\nsafe-outputs:/)[1]
    .replace(/^      /gm, "") + "\n";
  assert.equal(command, [
    "set -euo pipefail",
    "mkdir -p /tmp/gh-aw",
    "curl --fail --silent --show-error --max-time 60 \\",
    "  --output /tmp/gh-aw/copilot-pricing.txt \\",
    "  'https://docs.github.com/api/article/body?pathname=/en/copilot/reference/copilot-billing/models-and-pricing'",
    "test -s /tmp/gh-aw/copilot-pricing.txt",
    "date -u +%FT%TZ > /tmp/gh-aw/copilot-pricing-retrieved-at.txt",
    ""
  ].join("\n"));
  assert.match(workflowSource, /Use that timestamp unchanged/);
  assert.match(workflowSource, /Do not make network requests or generate a new retrieval timestamp/);
  assert.match(workflowSource, /Do not retry the request/);
  const lock = fs.readFileSync(
    path.join(__dirname, "..", "workflows", "update-copilot-models.lock.yml"), "utf8")
    .replace(/\r\n/g, "\n");
  const compiled = lock.match(/- name: Download official Copilot pricing\n\s+run: ("[^\n]*")\n\s+shell: bash/);
  assert(compiled, "Missing deterministic download step in the compiled workflow.");
  assert.equal(JSON.parse(compiled[1]), command);
  assert(lock.indexOf("name: Download official Copilot pricing")
    < lock.indexOf("name: Execute GitHub Copilot CLI"));
  assert(!lock.includes("shell(curl:*)"));
  assert(!lock.includes("--allow-tool web_fetch"));
});

const script = workflowSource.match(/            script: \|\n([\s\S]*?)\n---/)[1]
  .replace(/^              /gm, "");
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const publish = new AsyncFunction("require", "process", "github", "context", "core", script);

async function runPublication(rows, { staged = false, failWrite = false, blocked = false } = {}) {
  const writes = [];
  const items = [{
    type: "publish_models", catalogue: JSON.stringify(rows), retrieved_at: new Date().toISOString()
  }];
  if (blocked) items.push({ type: "create_issue", title: "Blocked update" });
  const requireFixture = (name) => {
    if (name === "node:fs") return { readFileSync: () => JSON.stringify({ items }) };
    if (name === "./.github/scripts/model-catalogue.cjs") return require("./model-catalogue.cjs");
    return require(name);
  };
  const github = { rest: { repos: {
    getContent: async ({ path: file, ref }) => {
      assert.equal(ref, file === "index.html" ? "main" : "workflow-sha");
      const content = file === "index.html" ? html : `GH_AW_INFO_STAGED: "${staged}"`;
      return { data: { type: "file", encoding: "base64",
        content: Buffer.from(content).toString("base64"), sha: "current-file-sha" } };
    },
    createOrUpdateFileContents: async (request) => {
      writes.push(request);
      if (failWrite) throw new Error("Publication blocked");
    }
  } } };
  let error;
  try {
    await publish(requireFixture, { env: {
      GH_AW_AGENT_OUTPUT: "fixture", GITHUB_WORKFLOW_SHA: "workflow-sha"
    } }, github, { repo: { owner: "fixture", repo: "calculator" } }, { info: () => {} });
  } catch (failure) {
    error = failure;
  }
  return { writes, error };
}

test("publication writes only index.html on main with a SHA guard and source evidence", async () => {
  const proposed = copy();
  proposed[0].input += 1;
  const { writes, error } = await runPublication(proposed);
  assert.equal(error, undefined);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].path, "index.html");
  assert.equal(writes[0].branch, "main");
  assert.equal(writes[0].sha, "current-file-sha");
  assert(writes[0].message.includes("Retrieved:"));
  assert(writes[0].message.includes("Co-authored-by: Copilot App"));
  assert.deepEqual(readCatalogue(Buffer.from(writes[0].content, "base64").toString("utf8")), proposed);
});

test("unchanged, staged, invalid and blocked updates never write to main", async () => {
  const proposed = copy();
  proposed[0].input += 1;
  for (const [rows, options] of [
    [copy(), {}], [proposed, { staged: true }], [[], {}], [proposed, { blocked: true }]
  ]) {
    const { writes, error } = await runPublication(rows, options);
    assert.equal(writes.length, 0);
    if (rows.length === 0 || options.blocked) assert(error);
    else assert.equal(error, undefined);
  }
});

test("a rejected publication fails explicitly after exactly one write attempt", async () => {
  const proposed = copy();
  proposed[0].input += 1;
  const { writes, error } = await runPublication(proposed, { failWrite: true });
  assert.equal(writes.length, 1);
  assert.match(error.message, /Publication blocked/);
});
