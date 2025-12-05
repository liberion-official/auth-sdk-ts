import { memo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import Providers from "@/common/context/providers";
import LibApp from "@/common/components/App/LibApp";
import "@/common/i18n";

const LiberionAuth = memo(function Widget({
  isOpen = false,
  backendUrl,
  successCb,
  closeCb,
  failedCb,
  theme,
}) {
  const [mounted, setMounted] = useState(false);

  const closeComponentHandler = () => {
    setMounted(false);
    closeCb && closeCb();
  };

  useEffect(() => {
    setMounted(isOpen);
  }, [isOpen]);

  if (mounted) {
    return createPortal(
      <Providers>
        <LibApp
          backendUrl={backendUrl}
          successCb={successCb}
          failedCb={failedCb}
          closeCb={closeComponentHandler}
          theme={theme}
        />
      </Providers>,
      document.body
    );
  }

  return null;
});

export { LiberionAuth };
