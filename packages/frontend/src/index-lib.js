import { createRoot } from "react-dom/client";
import { WIDGET_SCRIPT_ID, DEBUG } from "@/common/constants";
import Providers from "@/common/context/providers";
import LibApp from "@/common/components/App/LibApp";
import { logError } from "@/common/utils";
import "@/common/i18n";

if (DEBUG) {
  import("eruda").then((eruda) => {
    eruda.default.init();
  });
}

let root = null;
let container = null;
let externalCloseCb = null;

export const close = () => {
  if (root) {
    try {
      root.unmount();
    } catch (error) {
      logError("[close] unmount failed", error);
    }
    root = null;
  }
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;

  if (typeof externalCloseCb === "function") {
    try {
      externalCloseCb();
    } catch (error) {
      logError("[close] external close callback failed", error);
    }
  }
  externalCloseCb = null;
};

export const open = ({ backendUrl, successCb, closeCb, failedCb, theme }) => {
  if (container || root) close();

  container = document.createElement("div");
  container.id = WIDGET_SCRIPT_ID;
  document.body.appendChild(container);

  root = createRoot(container);
  externalCloseCb = closeCb;

  const teardown = () => close();

  root.render(
    <Providers>
      <LibApp
        backendUrl={backendUrl}
        successCb={successCb}
        failedCb={failedCb}
        closeCb={teardown}
        theme={theme}
      />
    </Providers>
  );
};
