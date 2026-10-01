# GitHub Copilot AI Cost Calculator

Calculateur statique du coût de fonctionnement des modèles disponibles dans GitHub Copilot.
Il convertit les volumes d'input, output, cached input et cache write en coût USD et en
GitHub AI Credits.

## Utilisation locale

Ouvrez directement `index.html` dans un navigateur, ou servez le dossier avec un serveur HTTP :

```powershell
python -m http.server 8000
```

Puis ouvrez `http://localhost:8000`.

## GitHub Pages

Dans les paramètres du dépôt, activez **Pages**, choisissez **Deploy from a branch**, puis
sélectionnez la branche à publier et le dossier racine `/`.

Les tarifs proviennent de la documentation
[Models and pricing for GitHub Copilot](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing).
