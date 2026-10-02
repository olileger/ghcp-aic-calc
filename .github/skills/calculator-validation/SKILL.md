---
name: calculator-validation
description: Use when changing or verifying token-cost arithmetic, share percentages, input parsing, number formatting, or AI Credit conversion in this calculator. Produces targeted numerical and interaction checks against the actual implementation without introducing a test framework or changing billing semantics.
metadata:
  version: "1.0"
---

# Validate calculator behavior

## Calculation contract

Read `parseVolume`, `formatVolumeInput`, `getVolumes`, `calculateTotal`,
`updateRenderedRow`, `renderModels`, and their event handlers in `index.html`.
Use the actual implementation, not a separately reimplemented formula, for checks.

The current baseline is:

```text
factor = share / 100
totalUSD = (
  inputRate * inputVolume
  + cachedInputRate * cachedInputVolume
  + supportedCacheWriteRate * cacheWriteVolume
  + outputRate * outputVolume
) * factor
credits = totalUSD / 0.01
```

Volumes are in millions. A `null` cache-write rate contributes zero to the total
but must still display "Not applicable"; it is not a supported free operation.
Each row has its own share, initially 100, constrained to 0 through 100.
Do not normalize shares or use aggregate volume to choose a context tier.

If the user has approved a verified billing-rule change, adapt this baseline and
the fixtures to that rule. Use `copilot-pricing-update` to verify such changes.

## Procedure

1. Identify the changed calculation surfaces and establish their baseline.
   Look for an existing runner first; this repository initially has none.
2. Exercise the actual functions in an available JavaScript runtime or browser.
   A temporary harness may isolate the relevant source definitions or provide
   minimal DOM fixtures. Do not duplicate the production arithmetic in the
   harness and then mistake agreement for a production check.
3. Use independent expected values and synthetic rates, so checks do not become
   obsolete whenever real catalogue prices change. The fixtures below use rates
   `input=2`, `cachedInput=0.2`, `cacheWrite=2.5`, and `output=10`.
4. Compare unformatted values with a small floating-point tolerance, such as
   absolute error at most `1e-9` for these small fixtures. Separately check
   displayed rounding; do not derive calculation correctness from rounded text.
5. Cover the relevant input and DOM interactions below in a browser when they are
   affected. Arithmetic-only execution does not establish UI correctness.
6. Keep temporary harnesses outside tracked application files and remove
   task-created temporary files afterward. Do not add dependencies or a permanent
   test runner unless the requested work requires it.
7. Record executed cases and failures in the handoff when requested. Distinguish
   automated, manual, and unexecuted checks; report missing tools explicitly.

## Independent arithmetic fixtures

The volume tuple below is ordered as input, cached input, cache write, output.
Expected credits assume the baseline conversion of 0.01 USD per credit.

| Case | Volumes in millions | Share | Cache-write rate | Expected USD | Expected credits |
| --- | --- | --- | --- | --- | --- |
| All volumes zero | 0, 0, 0, 0 | 100 | 2.5 | 0 | 0 |
| Input only | 1, 0, 0, 0 | 100 | 2.5 | 2 | 200 |
| Cached input only | 0, 1, 0, 0 | 100 | 2.5 | 0.2 | 20 |
| Cache write only | 0, 0, 1, 0 | 100 | 2.5 | 2.5 | 250 |
| Output only | 0, 0, 0, 1 | 100 | 2.5 | 10 | 1000 |
| Mixed categories | 1, 3, 3, 4 | 100 | 2.5 | 50.1 | 5010 |
| Half share | 1, 3, 3, 4 | 50 | 2.5 | 25.05 | 2505 |
| Fractional share | 1, 3, 3, 4 | 12.5 | 2.5 | 6.2625 | 626.25 |
| Zero share | 1, 3, 3, 4 | 0 | 2.5 | 0 | 0 |
| Unsupported cache write | 1, 3, 3, 4 | 100 | null | 42.6 | 4260 |
| Supported free cache write | 1, 3, 3, 4 | 100 | 0 | 42.6 | 4260 |
| One input token | 0.000001, 0, 0, 0 | 100 | 2.5 | 0.000002 | 0.0002 |

For changes to numeric range handling, also exercise large finite volumes and
values that can overflow the calculation. Do not silently render invalid results
as successful estimates; scope any changed input/error behavior explicitly.

## Input and integration checks

- `parseVolume("1 234,5")` and `parseVolume("1 234.5")` both yield `1234.5`.
  Exercise actual input events as well as the parser when formatting changes.
- Empty and nonnumeric volumes currently resolve to zero for calculation;
  an empty or invalid volume is reset to `"0"` on blur. Preserve this baseline
  unless the request explicitly changes validation behavior.
- Volume formatting accepts decimal commas, groups the integer part with spaces,
  and preserves the logical caret position. Check typing, pasting, and deletion.
- Changing a share updates category subtotals, USD, and credits for that row.
  A volume change updates all visible rows without losing their shares.
- A share below zero is clamped to zero; one above 100 is clamped to 100;
  an empty or nonnumeric share contributes zero. Check fractional shares too.
- Initial rendering and incremental row updates agree. Unsupported and free
  cache-write cells have different labels despite equal contribution.
- Filtering and sorting preserve shares by original model index, including rows
  with the same model name and different tiers.
- USD and credit sorting agree for the positive baseline conversion. While
  editing a share, the row updates in place; the `change` event reapplies sorting.
- "clear" sets all shares to zero, including filtered-out rows.
- "Reset values" sets volumes to zero, shares to 100, clears search, and focuses
  the first volume input. It currently preserves the active sort selection.

## Requirements

- Runtime: an available browser or JavaScript runtime for arithmetic; a browser
  with DOM access for interaction checks.
- Dependencies: none declared by this repository. Prefer tools already available.
- Network: not needed for baseline checks; official documentation only if billing
  semantics need verification.
- Filesystem: read `index.html` in the active checkout; any temporary harness must
  use an approved scratch location.
- Shell: optional to run a JavaScript harness or local static server. Stop any
  task-only server after validation.
- MCP and authentication: not required. If browser tooling is unavailable, report
  UI checks as unexecuted rather than claiming they passed.
