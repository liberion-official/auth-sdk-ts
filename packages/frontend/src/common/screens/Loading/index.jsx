import { useEffect } from "react";
import { PATHS } from "@/common/paths";
import { useAuthContext, useRootContext } from "@/common/context";
import GlobalPreloader from "@/common/components/GlobalPreloader";
import { AUTH_STATUSES } from "@/common/constants";

export default function LoadingPage() {
  const { navigate } = useRootContext();
  const { link, authStatus } = useAuthContext();

  useEffect(() => {
    if (link || authStatus === AUTH_STATUSES.error) {
      setTimeout(() => {
        navigate({ path: PATHS.auth, params: {} });
      }, 200);
    }
  }, [link, navigate, authStatus]);

  return <GlobalPreloader />;
}
