# @trust-proto/auth-react

## 0.4.1

### Patch Changes

- [`68ba1aa`](https://github.com/liberion-official/auth-sdk-ts/commit/68ba1aa0de93e7cf654e79ab1c0f0ff246013d3f) - Fix standalone bundle to properly include React

  The standalone bundle (`lib/liberion-auth.js`) was incorrectly configured with `externals` for React, requiring users to load React separately. This fix:
  - Changes entry point from `index-pkg.js` to `index-lib.js` for standalone bundle
  - Removes `externals` so React is bundled inside (~870 KB)
  - NPM package (`build/index.js`) now correctly uses `index-pkg.js` with React as peer dependency (~200 KB)

  **Standalone CDN usage now works without external React:**

  ```html
  <script src="https://cdn.jsdelivr.net/npm/@trust-proto/auth-react/lib/liberion-auth.js"></script>
  <script>
    LiberionAuth.open({ backendUrl: 'wss://...', successCb: (r) => console.log(r.token) });
  </script>
  ```

## 0.4.0

### Minor Changes

- [`be1e556`](https://github.com/liberion-official/auth-sdk-ts/commit/be1e5564296cf25bd65bb868481ac76cd2f2b4e2) - Add standalone UMD bundle for browser usage

  The package now includes a standalone UMD bundle (`lib/liberion-auth.js`) that can be used directly in browsers without build tools. The bundle is:
  - Available via NPM CDN: unpkg.com and jsdelivr.net
  - Included in GitHub Releases as downloadable asset

  This enables easy integration with WordPress, static sites, and other non-build-tool environments.

## 0.3.0

### Minor Changes

- [`4579ee6`](https://github.com/liberion-official/auth-sdk-ts/commit/4579ee66ace7954760466e60415fc28c4b1f8acf) - Add standalone UMD bundle for browser usage

  The package now includes a standalone UMD bundle (`lib/liberion-auth.js`) that can be used directly in browsers without build tools. The bundle is:
  - Available via NPM CDN: unpkg.com and jsdelivr.net
  - Included in GitHub Releases as downloadable asset

  This enables easy integration with WordPress, static sites, and other non-build-tool environments.

### Patch Changes

- [`4579ee6`](https://github.com/liberion-official/auth-sdk-ts/commit/4579ee66ace7954760466e60415fc28c4b1f8acf) - Update dependencies: i18next, react-i18next, react-router, and dev dependencies

## 0.2.0

### Minor Changes

- [`e63c370`](https://github.com/liberion-official/auth-sdk-ts/commit/e63c370eaabe731b9d1752210973494ac9b5fa88) - Initial release of @trust-proto packages with post-quantum authentication
