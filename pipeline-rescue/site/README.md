# Pipeline Rescue Public Site

This folder contains the static public site for the first Pipeline Rescue pilot offer.

## Pages

- `index.html`: commercial overview
- `pilot.html`: 30-day pilot offer
- `privacy.html`: pilot privacy notice summary
- `terms.html`: pilot terms summary
- `404.html`: fallback page for GitHub Pages

## Local preview

Open `index.html` directly in a browser, or serve the folder with any static file server.

## Validation

Run the local link checker before publishing:

```bash
node pipeline-rescue/site/check-site-links.js
```

## GitHub Pages

The repository workflow `.github/workflows/pipeline-rescue-pages.yml` publishes this folder to GitHub Pages on pushes to `main`.

Before public use, configure:

- support contact email
- legal provider identity
- final billing method
- reviewed privacy and pilot terms
