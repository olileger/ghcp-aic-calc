# GitHub Copilot AI Cost Calculator

A static cost calculator for models available in GitHub Copilot.
It converts input, output, cached input, and cache write token volumes into USD costs and
GitHub AI Credits.

## Local usage

Open `index.html` directly in a browser, or serve the directory with an HTTP server:

```powershell
python -m http.server 8000
```

Then open `http://localhost:8000`.

Keep `favicon.ico` alongside `index.html` to display the GitHub logo in browser tabs
and bookmarks. The icon is bundled from [GitHub's favicon](https://github.com/favicon.ico);
the calculator does not fetch it from GitHub at runtime.

The **Tokens** and **Discount** sections start expanded. Click their arrow or title
to collapse or expand each section independently; only the title and arrow remain
visible when collapsed. The same controls work with Enter or Space on the keyboard.
Collapsing a section preserves its entered values and does not change the calculations.
The **Discount** section is available only when enabled as described below.

### Optional discount

Append `?ff=d` to the URL (for example, `http://localhost:8000/?ff=d` or
`index.html?ff=d`) to show the **Discount** section between **Tokens** and **Models**.
Enter a percentage from 0 to 100; fractional percentages are supported. The discount
applies immediately to all displayed model rates, category subtotals, USD totals and
AI Credits, while each model's share still applies independently. Unsupported cache
writes remain "Not applicable". **Reset values** also resets the discount to 0%.

Without the `d` feature flag, the section is hidden and no discount applies.
Feature flags use `+` separators, such as `?ff=d+f+g+e`; only `d` is currently
implemented and unknown flags are ignored. If the URL already has query parameters,
append `&ff=d` instead. This also works when opening the calculator directly as a file.

## GitHub Pages

In the repository settings, enable **Pages**, choose **Deploy from a branch**, then select
the branch to publish and the root directory `/`.

Pricing data comes from the
[Models and pricing for GitHub Copilot](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing).

## Daily model catalogue update

The [Update Copilot model catalogue](.github/workflows/update-copilot-models.md)
GitHub Agentic Workflow runs every day at **09:00 Europe/Paris**, following daylight
saving time. GitHub Actions may start scheduled runs later during busy periods.
It can also be started manually from the Actions tab.

A deterministic Actions step downloads the
[official article body](https://docs.github.com/api/article/body?pathname=/en/copilot/reference/copilot-billing/models-and-pricing)
once and records its UTC retrieval timestamp before the agent starts. An HTTP
error or empty response fails the step without starting the agent. The agent
reads the prepared files locally, without fetching the source itself, verifies
the complete catalogue, saves it to a fixed JSON file, and requests publication
with a readiness flag only. The catalogue file and original retrieval timestamp
are transferred through the run's artifact; the publication job reads them
directly, without the agent copying JSON into tool arguments or invoking `jq`.
Missing, empty, or invalid catalogue files block publication.
Only the `models` array in `index.html` can change. A deterministic job
checks the data, JavaScript syntax, arithmetic, and credit conversion before
committing. Unchanged catalogues produce no commit. The source URL and retrieval
timestamp are recorded in each update commit.

At the first problem, the agent stops without retrying or publishing partial
changes and requests an English issue explaining the blocker. Identical issue
titles are deduplicated. Failed-job reporting also opens an issue when execution
or publication fails outside the agent, provided Actions still has permission to
create issues. Branch protection is never bypassed.

### Enable the workflow

Merge the workflow source, its generated `.lock.yml`, and the validation script
into `main`; scheduled workflows only run from the default branch. Enable GitHub
Actions and add a repository Actions secret named `COPILOT_GITHUB_TOKEN`: a
fine-grained PAT owned by a user with a Copilot license and **Copilot Requests:
Read** account permission. See the
[Agentic Workflows authentication guide](https://github.github.com/gh-aw/reference/auth/).
Never put a token in a tracked file.

Publication uses the job-scoped `GITHUB_TOKEN` with `contents: write` by default.
For branch-based GitHub Pages deployments, add `MODEL_UPDATE_TOKEN`, a
fine-grained PAT with **Contents: Read and write** for this repository. Commits
made using `GITHUB_TOKEN` do not trigger a Pages build; an appropriately authorized
PAT allows normal push-triggered deployment. This token is exposed only to the
trusted publication step, not to the agent. The workflow also needs permission to
create issues. Copilot usage and GitHub Actions minutes may incur charges.

To change the instructions or schedule, edit the Markdown source and regenerate
the committed lock file using the GitHub CLI and the `github/gh-aw` extension:

```powershell
gh aw compile update-copilot-models
```

Do not edit the generated lock file manually. The calculator remains standalone:
it does not fetch pricing at browser runtime or depend on the workflow to run.

Run the dependency-free calculator, catalogue and publication guard checks with:

```powershell
node --test .github\scripts\calculator.test.cjs .github\scripts\model-catalogue.test.cjs
```

## Copilot agent and skills

The repository includes the `copilot-cost-maintainer` custom agent in
[`.github/agents/copilot-cost-maintainer.agent.md`](.github/agents/copilot-cost-maintainer.agent.md).
Select it in a Copilot host that supports custom agents to maintain the calculator.
Discovery and refresh behavior depend on the host; GitHub-hosted agent selection
requires the profile to be merged into the default branch.

Three project skills provide task-specific procedures:

| Skill | Use |
| --- | --- |
| [`copilot-pricing-update`](.github/skills/copilot-pricing-update/SKILL.md) | Verify models, rates, context tiers, and credit conversion against official GitHub documentation. |
| [`calculator-validation`](.github/skills/calculator-validation/SKILL.md) | Check token-cost arithmetic, units, shares, formatting, and calculation-related interactions. |
| [`static-calculator-ui`](.github/skills/static-calculator-ui/SKILL.md) | Maintain themes, responsive layout, accessibility, filtering, sorting, and reset behavior. |

For example, ask the agent to "Update the Copilot pricing catalogue using the
official documentation" or "Check calculation behavior for fractional shares and
unsupported cache-write pricing." Copilot loads relevant skills according to the
task; you can also name a skill explicitly. The agent references all three skills,
but listing them in its profile does not automatically load them.

These are repository-local instructions, not a separate installation or an SDP
catalogue package. No MCP server, credentials, or additional application dependency
is required. Pricing verification needs access to public GitHub documentation;
UI checks need a browser. The skills contain procedures and numerical fixtures;
the dependency-free checks above cover calculator behavior and catalogue publication.
