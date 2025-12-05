import { useRootContext } from "@/common/context";
import { PATHS } from "@/common/paths";
import LoadingPage from "@/common/screens/Loading";
import AuthPage from "@/common/screens/Auth";

export default function Screens() {
  const { screen } = useRootContext();

  return (
    <>
      {
        {
          [PATHS.loading]: <LoadingPage />,
          [PATHS.auth]: <AuthPage />,
        }[screen.path]
      }
    </>
  );
}
