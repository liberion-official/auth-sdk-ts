---
"@trust-proto/auth-react": patch
---

Fix standalone bundle to properly include React

The standalone bundle (`lib/liberion-auth.js`) was incorrectly configured with `externals` for React, requiring users to load React separately. This fix:

- Changes entry point from `index-pkg.js` to `index-lib.js` for standalone bundle
- Removes `externals` so React is bundled inside (~870 KB)
- NPM package (`build/index.js`) now correctly uses `index-pkg.js` with React as peer dependency (~200 KB)

**Standalone CDN usage now works without external React:**
```html
<script src="https://cdn.jsdelivr.net/npm/@trust-proto/auth-react/lib/liberion-auth.js"></script>
<script>
  LiberionAuth.open({ backendUrl: "wss://...", successCb: (r) => console.log(r.token) });
</script>
```
