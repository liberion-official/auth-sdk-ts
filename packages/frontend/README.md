# Liberion Auth - Integration Guide

Liberion Auth is a modern authentication widget for web applications.

---

## Installation as NPM Package

Install the npm package:

```bash
npm i @trust-proto/auth-react
```

## Standalone Browser Usage (CDN)

**CDN Options:**
- unpkg: `https://unpkg.com/@trust-proto/auth-react@{version}/lib/liberion-auth.js`
- jsDelivr: `https://cdn.jsdelivr.net/npm/@trust-proto/auth-react@{version}/lib/liberion-auth.js`
- GitHub Releases: Download from [releases page](https://github.com/liberion-official/auth-sdk-ts/releases)

---

### React Example with NPM Package

**Props:**

| Parameter    | Type       | Required | Description                                                        |
| ------------ | ---------- | -------- | ------------------------------------------------------------------ |
| `backendUrl` | `string`   | ✅        | WebSocket authentication server URL                                |
| `isOpen`     | `boolean`  | ✅        | Controls widget visibility (true/false)                            |
| `theme`      | `string`   | ❌        | Theme mode: `'light'` or `'dark'` (default: `'dark'`)              |
| `successCb`  | `function` | ❌        | Callback function called on success. Receives authentication token |
| `failedCb`   | `function` | ❌        | Callback function called on error.                                 |
| `closeCb`    | `function` | ❌        | Callback function called when widget is closed                     |

Import the widget into your React application:

```jsx
import { useState } from "react";
import { LiberionAuth } from "@trust-proto/auth-react";

function App() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button onClick={() => setIsOpen(true)}>Login with Liberion ID</button>

      <LiberionAuth
        backendUrl="wss://your-backend-url.example.com"
        isOpen={isOpen}
        theme="light"
        closeCb={() => setIsOpen(false)}
        successCb={(result) => {
          console.log("Authentication successful, result:", result);
          localStorage.setItem("authToken", result.token);
        }}
        failedCb={(error) => {
          console.error("Authentication failed:", error);
        }}
      />
    </>
  );
}

export default App;
```

### React Example with script tag

```jsx
import React, { useState, useEffect } from "react";

const App = () => {
  const [isWidgetLoaded, setIsWidgetLoaded] = useState(false);
  const [token, setToken] = useState(null);

  // Load widget script
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.statically.io/gh/liberion-official/auth-sdk-frontend/main/build/index.js";
    script.async = true;
    script.onload = () => setIsWidgetLoaded(true);
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Check for existing token
  useEffect(() => {
    const savedToken = localStorage.getItem("authToken");
    if (savedToken) {
      setToken(savedToken);
    }
  }, []);

  const handleLogin = () => {
    if (!isWidgetLoaded) return;

    window.LiberionAuth.open({
      backendUrl: "wss://your-backend-url.example.com",
      successCb: (result) => {
        console.log("Authentication successful, result:", result);
        localStorage.setItem("authToken", result.token);
        setToken(result.token);
      },
      failedCb: (error) => {
        console.error("Authentication failed:", error);
      },
      closeCb: () => {
        console.log("Widget closed");
      },
      theme: "light",
    });
  };

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    setToken(null);
  };

  if (!token) {
    return (
      <div>
        <h1>Welcome!</h1>
        <button onClick={handleLogin} disabled={!isWidgetLoaded}>
          {isWidgetLoaded ? "Login" : "Loading..."}
        </button>
      </div>
    );
  }

  return (
    <div>
      <h1>You are authenticated!</h1>
      <p>Token: {token.substring(0, 20)}...</p>
      <button onClick={handleLogout}>Logout</button>
    </div>
  );
};

export default App;
```
