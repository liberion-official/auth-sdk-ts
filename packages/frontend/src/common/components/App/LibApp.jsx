import { useEffect } from "react";
import {
  useRootContext,
  useThemeContext,
  useAuthContext,
} from "@/common/context";
import { Layout } from "@/common/layout/layout";
import { CALLBACKS, THEME_MODES } from "@/common/constants";
import Screens from "@/common/screens";

export default function LibApp({
  backendUrl,
  closeCb,
  successCb,
  failedCb,
  theme = THEME_MODES.DARK,
}) {
  const { setCallbacks } = useRootContext();
  const { setBackendUrl } = useAuthContext();
  const { setTheme } = useThemeContext();

  useEffect(() => {
    setCallbacks((s) => ({
      [CALLBACKS.close]: closeCb ?? s[CALLBACKS.close],
      [CALLBACKS.success]: successCb ?? s[CALLBACKS.success],
      [CALLBACKS.failed]: failedCb ?? s[CALLBACKS.failed],
    }));
    setBackendUrl(backendUrl);
    setTheme(theme);
  }, [
    closeCb,
    successCb,
    failedCb,
    backendUrl,
    theme,
    setBackendUrl,
    setCallbacks,
    setTheme,
  ]);

  return (
    <Layout>
      <Screens />
    </Layout>
  );
}
