---
"@trust-proto/auth-react": patch
"@trust-proto/auth-node": patch
---

Remove react-router dependency and simplify frontend architecture

- Removed react-router from dependencies (reduces bundle size)
- Added jsx-runtime externals to webpack for proper React 18+ support
- Simplified StandaloneAuthPage component
- Pinned libsodium-wrappers to 0.7.15 to fix ESM module issue
