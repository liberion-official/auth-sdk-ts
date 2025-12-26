# Liberion Auth - Integration Guide

Liberion Auth is a modern authentication widget for web applications.

## Two Ways to Use

| Method             | Use Case           | React Required            |
| ------------------ | ------------------ | ------------------------- |
| **NPM Package**    | React applications | Yes (peer dependency)     |
| **Standalone CDN** | Any website        | No (React bundled inside) |

---

## Option 1: NPM Package (React Projects)

Install the npm package:

```bash
npm i @trust-proto/auth-react
```

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
        backendUrl="wss://your-server.address"
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

---

## Option 2: Standalone CDN (Any Website)

Use this method for non-React websites. React is bundled inside — no dependencies required.

**CDN Options:**
- jsDelivr: `https://cdn.jsdelivr.net/npm/@trust-proto/auth-react@latest/lib/liberion-auth.js`
- unpkg: `https://unpkg.com/@trust-proto/auth-react@latest/lib/liberion-auth.js`
- GitHub Releases: Download from [releases page](https://github.com/liberion-official/auth-sdk-ts/releases)

### Standalone API

| Method                       | Description                       |
| ---------------------------- | --------------------------------- |
| `LiberionAuth.open(options)` | Open the authentication widget    |
| `LiberionAuth.close()`       | Close the widget programmatically |

**Options:**

| Parameter    | Type       | Required | Description                               |
| ------------ | ---------- | -------- | ----------------------------------------- |
| `backendUrl` | `string`   | ✅        | WebSocket authentication server URL       |
| `theme`      | `string`   | ❌        | `'light'` or `'dark'` (default: `'dark'`) |
| `successCb`  | `function` | ❌        | Called on success with `{ token }` object |
| `failedCb`   | `function` | ❌        | Called on error                           |
| `closeCb`    | `function` | ❌        | Called when widget is closed              |

### Basic HTML Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Liberion Auth Demo</title>
</head>
<body>
  <button id="login-btn">Login with Liberion ID</button>

  <script src="https://cdn.jsdelivr.net/npm/@trust-proto/auth-react@latest/lib/liberion-auth.js"></script>
  <script>
    document.getElementById('login-btn').onclick = function() {
      LiberionAuth.open({
        backendUrl: 'wss://your-backend-url.example.com',
        theme: 'light',
        successCb: function(result) {
          console.log('Token:', result.token);
          alert('Authentication successful!');
        },
        failedCb: function(error) {
          console.error('Failed:', error);
        },
        closeCb: function() {
          console.log('Widget closed');
        }
      });
    };
  </script>
</body>
</html>
```

### React with Script Tag (Dynamic Loading)

```jsx
import React, { useState, useEffect } from "react";

const App = () => {
  const [isWidgetLoaded, setIsWidgetLoaded] = useState(false);
  const [token, setToken] = useState(null);

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/@trust-proto/auth-react@latest/lib/liberion-auth.js";
    script.async = true;
    script.onload = () => setIsWidgetLoaded(true);
    document.body.appendChild(script);
    return () => document.body.removeChild(script);
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("authToken");
    if (savedToken) setToken(savedToken);
  }, []);

  const handleLogin = () => {
    if (!isWidgetLoaded) return;
    window.LiberionAuth.open({
      backendUrl: "wss://your-backend-url.example.com",
      theme: "light",
      successCb: (result) => {
        localStorage.setItem("authToken", result.token);
        setToken(result.token);
      },
      failedCb: (error) => console.error("Failed:", error),
      closeCb: () => console.log("Widget closed"),
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

---

## Build Outputs

| File                   | Size    | Description                            |
| ---------------------- | ------- | -------------------------------------- |
| `build/index.js`       | ~200 KB | NPM package (React as peer dependency) |
| `lib/liberion-auth.js` | ~870 KB | Standalone bundle (React included)     |
