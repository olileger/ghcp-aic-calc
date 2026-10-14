const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "..", "index.html"), "utf8");
const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].at(-1)[1];

function element(value = "") {
  return {
    value, dataset: {}, attributes: {}, listeners: new Map(),
    addEventListener(type, listener) { this.listeners.set(type, listener); },
    dispatch(type, event) { this.listeners.get(type)?.(event); },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus() { this.focused = true; }
  };
}

function calculator(search = "") {
  const ids = Object.fromEntries([
    "models-body", "model-search", "model-count", "empty-state",
    "discount", "discount-panel", "clear-shares", "reset-button"
  ].map((id) => [id, element()]));
  ids.discount.value = "0";
  const volumes = ["input", "cachedInput", "cacheWrite", "output"].map((costType) => {
    const input = element("0");
    input.dataset.volume = costType;
    return input;
  });
  const sortButtons = ["total", "credits"].flatMap((sortKey) =>
    ["asc", "desc"].map((sortDirection) => {
      const button = element();
      button.dataset = { sortKey, sortDirection };
      return button;
    })
  );
  const context = vm.createContext({
    URLSearchParams,
    window: { location: { search } },
    document: {
      getElementById: (id) => {
        assert(id in ids, `Unexpected element: ${id}`);
        return ids[id];
      },
      querySelectorAll: (selector) => {
        assert(["[data-volume]", "[data-sort-key]"].includes(selector));
        return selector === "[data-volume]" ? volumes : sortButtons;
      }
    }
  });
  vm.runInContext(script, context);
  return { context, ids, volumes, sortButtons };
}

test("token and discount sections use independent, initially open disclosures", () => {
  for (const [panel, title, controls] of [
    ["tokens", "Tokens (in million)", [
      "reset-button", "input-tokens", "output-tokens", "cached-input-tokens", "cached-output-tokens"
    ]],
    ["discount", "Discount", ["discount"]]
  ]) {
    const section = html.match(
      new RegExp(`<section class="panel ${panel}-panel"[^>]*>([\\s\\S]*?)</section>`)
    )?.[1];
    assert(section, `${panel} section must exist`);
    const disclosure = section.match(/<details class="collapsible-section" open>([\s\S]*?)<\/details>/)?.[1];
    assert(disclosure, `${panel} must start expanded without a shared disclosure group`);
    const summary = disclosure.match(/^\s*<summary>([\s\S]*?)<\/summary>/);
    assert(summary, `${panel} must have a native summary as its first child`);
    assert(summary[1].includes(`<h2 id="${panel}-title">${title}</h2>`));
    const content = disclosure.slice(summary[0].length);
    assert.match(content, /class="section-description"/);
    for (const id of controls) {
      assert(content.includes(`id="${id}"`), `${id} must collapse with its section content`);
    }
  }
});

test("discount is opt-in and plus-separated flags match whole names", () => {
  assert.match(html, /<section class="panel discount-panel"[^>]* hidden>/);
  assert.match(html, /<input id="discount"[^>]*min="0" max="100" step="any"/);
  for (const [search, enabled] of [
    ["", false], ["?ff=", false], ["?ff=f+g", false], ["?ff=dd", false],
    ["?ff=discount", false], ["?ff=D", false], ["?ff=d", true],
    ["?ff=d+f+g+e", true], ["?ff=f+d", true], ["?ff=f%2Bd%2Bg", true],
    ["?clawpilotTheme=dark&ff=d", true]
  ]) {
    const { context, ids } = calculator(search);
    assert.equal(ids["discount-panel"].hidden, !enabled, search);
    assert.equal(ids.discount.disabled, !enabled, search);
    ids.discount.value = "50";
    assert.equal(context.getDiscount(), enabled ? 50 : 0, search);
    assert.equal(ids.discount.listeners.has("input"), enabled, search);
  }
});

test("discounted rates, USD and credits compose with independent shares", () => {
  const { context, ids } = calculator("?ff=d");
  const model = { input: 2, cachedInput: 0.2, cacheWrite: 2.5, output: 10 };
  const volumes = { input: 1, cachedInput: 3, cacheWrite: 3, output: 4 };
  const baseline = JSON.stringify(model);
  for (const [discount, share, expected] of [
    [0, 100, 50.1], [25, 100, 37.575], [12.5, 100, 43.8375],
    [25, 50, 18.7875], [25, 12.5, 4.696875], [25, 0, 0], [100, 100, 0]
  ]) {
    ids.discount.value = String(discount);
    const discounted = context.getDiscountedModel(model);
    const total = context.calculateTotal(discounted, volumes, share);
    assert(Math.abs(total - expected) <= 1e-9);
    assert(Math.abs(total / 0.01 - expected * 100) <= 1e-9);
    assert.equal(discounted.input, model.input * (1 - discount / 100));
    assert.equal(JSON.stringify(model), baseline, "Catalogue rates must not be mutated");
  }
  ids.discount.value = "25";
  const oneToken = context.calculateTotal(
    context.getDiscountedModel(model),
    { input: 0.000001, cachedInput: 0, cacheWrite: 0, output: 0 }, 100
  );
  assert(Math.abs(oneToken - 0.0000015) <= 1e-9);
  assert.match(context.priceContent(1.5, 0.000001), /= \$0\.000002/);
});

test("a full discount preserves unsupported versus supported free cache writes", () => {
  const { context, ids } = calculator("?ff=d");
  ids.discount.value = "100";
  for (const cacheWrite of [null, 0, 2.5]) {
    const model = context.getDiscountedModel({ input: 2, cachedInput: 0.2, cacheWrite, output: 10 });
    assert.equal(model.cacheWrite, cacheWrite === null ? null : 0);
    assert.equal(context.priceContent(model.cacheWrite, 3) === "Not applicable", cacheWrite === null);
    assert.equal(context.calculateTotal(model, { input: 1, cachedInput: 3, cacheWrite: 3, output: 4 }, 100), 0);
  }
});

test("discount values are bounded and normalized when editing finishes", () => {
  const { context, ids } = calculator("?ff=d");
  for (const [value, expected] of [
    ["", 0], ["invalid", 0], ["Infinity", 0], ["-10", 0], ["150", 100], ["12.5", 12.5]
  ]) {
    ids.discount.value = value;
    assert.equal(context.getDiscount(), expected);
    ids.discount.dispatch("change");
    assert.equal(ids.discount.value, String(expected));
  }
});

test("incremental share updates agree with rendering after a discount", () => {
  const { context, ids, volumes } = calculator("?ff=d");
  [2, 3, 3, 4].forEach((value, index) => { volumes[index].value = String(value); });
  ids.discount.value = "20";
  ids.discount.dispatch("input");
  assert.match(ids["models-body"].innerHTML, /\$0\.20 × 2\.00/);
  const cells = Object.fromEntries(
    ["input", "cachedInput", "cacheWrite", "output", "total", "credits"].map((key) => [
      key, { classList: { toggle() {} } }
    ])
  );
  const row = {
    querySelector: (selector) => cells[selector.match(/data-cost="([^"]+)"|data-(total|credits)/).slice(1).find(Boolean)]
  };
  const shareInput = {
    value: "50", dataset: { shareIndex: "0" }, closest: () => row
  };
  ids["models-body"].dispatch("input", { target: { closest: () => shareInput } });
  assert.equal(cells.total.textContent, "$3.43");
  assert.equal(cells.credits.textContent, "343.00");
  assert.match(cells.input.innerHTML, /\$0\.20 × 1\.00/);
  assert.equal(cells.cacheWrite.innerHTML, "Not applicable");
  context.renderModels();
  const rendered = ids["models-body"].innerHTML.match(/<tr data-model-index="0">([\s\S]*?)<\/tr>/)[1];
  assert.match(rendered, /value="50"/);
  assert(rendered.includes(cells.input.innerHTML));
  assert.match(rendered, /data-total>\$3\.43</);
  assert.match(rendered, /data-credits>343\.00</);
});

test("search requires every whitespace-separated term across provider, model and tier", () => {
  const { context, ids } = calculator();
  const catalogue = [
    ["OpenAI", "GPT-5.5", "Default"],
    ["OpenAI", "GPT-5.5", "Long context"],
    ["Anthropic", "Claude Sonnet 5.5", "Default"],
    ["Anthropic", "Claude Haiku 4.5", "Default"],
    ["Anthropic", "Claude Haiku 5.5", "Long context"],
    ["Moonshot AI", "Kimi K3", "Default"]
  ].map(([provider, model, tier]) => ({
    provider, model, tier, threshold: "Not applicable",
    input: 1, cachedInput: 0.1, cacheWrite: null, output: 2
  }));
  vm.runInContext(`models.splice(0, models.length, ...${JSON.stringify(catalogue)});`, context);

  for (const [query, expected] of [
    ["Anthropic 5.5", [2, 4]],
    ["OpenAI 5.5", [0, 1]],
    ["5.5 Anthropic", [2, 4]],
    ["  oPeNaI   5.5  ", [0, 1]],
    ["OpenAI\t5.5\nlong   context", [1]],
    ["context long", [1, 4]],
    ["Anthropic Haiku 5.5", [4]],
    ["Moonshot AI", [5]],
    ["Claude Sonnet", [2]],
    ["5.5", [0, 1, 2, 4]],
    ["haik", [3, 4]],
    ["OpenAI Anthropic", []],
    ["OpenAI 5.5 missing", []],
    ["5x5", []],
    ["", [0, 1, 2, 3, 4, 5]],
    [" \t\n ", [0, 1, 2, 3, 4, 5]]
  ]) {
    ids["model-search"].value = query;
    ids["model-search"].dispatch("input");
    const indices = [...ids["models-body"].innerHTML.matchAll(/<tr data-model-index="(\d+)">/g)]
      .map((match) => Number(match[1]));
    assert.deepEqual(indices, expected, query);
    assert.equal(ids["model-count"].textContent,
      `${expected.length} model${expected.length === 1 ? "" : "s"}`, query);
    assert.equal(ids["empty-state"].hidden, expected.length > 0, query);
  }

  vm.runInContext("modelShares[1] = 37.5;", context);
  ids["model-search"].value = "Anthropic 5.5";
  ids["model-search"].dispatch("input");
  ids["model-search"].value = "OpenAI 5.5";
  ids["model-search"].dispatch("input");
  const preservedRow = ids["models-body"].innerHTML.match(/<tr data-model-index="1">([\s\S]*?)<\/tr>/)[1];
  assert.match(preservedRow, /value="37\.5"/);
});

test("filtering, sorting, clearing and reset preserve their contracts with a discount", () => {
  const { ids, volumes, sortButtons } = calculator("?ff=d");
  volumes[0].value = "1";
  ids.discount.value = "50";
  ids.discount.dispatch("input");
  ids["model-search"].value = "OpenAI";
  ids["model-search"].dispatch("input");
  assert(!ids["models-body"].innerHTML.includes('class="provider-cell">Anthropic'));
  sortButtons[1].dispatch("click");
  assert.equal(sortButtons[1].attributes["aria-pressed"], "true");
  ids["clear-shares"].dispatch("click");
  assert(!/data-total>\$(?!0\.00<)/.test(ids["models-body"].innerHTML));
  ids["model-search"].value = "";
  ids["model-search"].dispatch("input");
  assert(!/data-total>\$(?!0\.00<)/.test(ids["models-body"].innerHTML));
  ids["reset-button"].dispatch("click");
  assert.equal(ids.discount.value, "0");
  assert.equal(ids["discount-panel"].hidden, false);
  assert.equal(ids["model-search"].value, "");
  assert(volumes.every((input) => input.value === "0"));
  assert(volumes[0].focused);
  assert(!/value="0"\s+aria-label="Share/.test(ids["models-body"].innerHTML));
  assert.equal(sortButtons[1].attributes["aria-pressed"], "true");
});
