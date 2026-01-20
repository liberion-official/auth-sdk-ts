---
"@trust-proto/auth-react": patch
---

Remove react-router dependency and simplify frontend architecture

- Removed react-router from dependencies (reduces bundle size)
- Added jsx-runtime externals to webpack for proper React 18+ support
- Simplified StandaloneAuthPage component
