import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Providers from "@/common/context/providers";
import StandaloneAuthPage from "@/common/screens/StandaloneAuth";
import "@/common/i18n";

const domNode = document.getElementById("root");
const root = createRoot(domNode);

root.render(
  <StrictMode>
    <Providers>
      <StandaloneAuthPage />
    </Providers>
  </StrictMode>
);
