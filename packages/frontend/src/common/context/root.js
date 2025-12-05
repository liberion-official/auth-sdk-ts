import { useState, createContext, useCallback, useContext } from "react";
import { PATHS } from "@/common/paths";
import { CALLBACKS } from "@/common/constants";
import { log } from "@/common/utils";

export const RootContext = createContext();

export const useRootContext = () => {
  return useContext(RootContext);
};

export const RootProvider = ({ children }) => {
  const [screen, setScreen] = useState({ path: PATHS.loading, params: {} });
  const [callbacks, setCallbacks] = useState({
    [CALLBACKS.close]: () => log("DEFAULT CLOSE CB"),
    [CALLBACKS.success]: () => log("DEFAULT SUCCESS CB"),
    [CALLBACKS.failed]: () => log("DEFAULT FAILED CB"),
  });

  const [closing, setClosing] = useState(false);

  const navigate = useCallback(({ path, params }) => {
    setScreen({ path, params });
  }, []);

  const value = {
    screen,
    navigate,
    callbacks,
    setCallbacks,
    closing,
    setClosing,
  };

  return <RootContext.Provider value={value}>{children}</RootContext.Provider>;
};
