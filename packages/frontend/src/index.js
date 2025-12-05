import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import Providers from "@/common/context/providers";
import HomePage from "@/common/screens/Home";
import StandaloneAuthPage from "@/common/screens/StandaloneAuth";
import "@/common/i18n";

const domNode = document.getElementById("root");
const root = createRoot(domNode);

const router = createBrowserRouter([
  {
    path: "/:url",
    element: <StandaloneAuthPage />,
  },
  {
    path: "*",
    element: <HomePage />,
  },
]);

root.render(
  <StrictMode>
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  </StrictMode>
);
