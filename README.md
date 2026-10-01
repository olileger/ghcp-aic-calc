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
