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

## GitHub Pages

In the repository settings, enable **Pages**, choose **Deploy from a branch**, then select
the branch to publish and the root directory `/`.

Pricing data comes from the
[Models and pricing for GitHub Copilot](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing).

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
UI checks need a browser. The skills contain procedures and numerical fixtures,
not a bundled automated test suite.
