import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { CALLBACKS, AUTH_STATUSES, SOCKET_MESSAGES } from "@/common/constants";
import { log } from "@/common/utils";
import { LiberionSocket } from "@/common/socket";
import { useRootContext } from "./root";

const AuthContext = createContext();

export const useAuthContext = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [backendUrl, setBackendUrl] = useState("");
  const [link, setLink] = useState("");
  const [authStatus, setAuthStatus] = useState(AUTH_STATUSES.default);

  const socketRef = useRef(null);
  const sessionIdRef = useRef(null);
  const reconnectAttemptedRef = useRef(false);

  const { callbacks, setClosing } = useRootContext();

  const initializeSocket = useCallback(
    async (url) => {
      const handleMessage = (json) => {
        if (json?._ === SOCKET_MESSAGES.ACTIVATED) {
          setAuthStatus(AUTH_STATUSES.awaiting);
        }

        if (json?._ === SOCKET_MESSAGES.ERROR) {
          setAuthStatus(AUTH_STATUSES.error);
          callbacks[CALLBACKS.failed]?.();
        }

        if (json?.message === SOCKET_MESSAGES.AUTH_DECLINED) {
          setAuthStatus(AUTH_STATUSES.cancel);
          callbacks[CALLBACKS.failed]?.();
        }

        if (json?.message === SOCKET_MESSAGES.AUTH_TIMEOUT) {
          setAuthStatus(AUTH_STATUSES.timeout);
          setClosing(true);
          callbacks[CALLBACKS.failed]?.();
        }

        if (json?.message === SOCKET_MESSAGES.WELCOME) {
          callbacks[CALLBACKS.success]?.({
            token: json.payload.token,
          });
          setAuthStatus(AUTH_STATUSES.success);
          setClosing(true);

          socketRef.current = null;
          sessionIdRef.current = null;
          reconnectAttemptedRef.current = false;
        }
      };

      const socket = new LiberionSocket({
        address: url,
        onClose: async (event) => {
          log("WebSocket closed:", event);

          const currentSocket = socketRef.current;
          const currentSessionId = sessionIdRef.current;

          // Only reconnect if we have sessionId and haven't tried yet
          if (!currentSessionId || reconnectAttemptedRef.current) {
            return;
          }

          // Mark that we've attempted reconnect (one attempt only)
          reconnectAttemptedRef.current = true;

          log(
            "WebSocket closed, attempting reconnect with sessionId:",
            currentSessionId
          );

          try {
            await currentSocket.reconnect();

            const response = await currentSocket.send({
              _: SOCKET_MESSAGES.RECONNECT,
              sessionId: currentSessionId,
            });

            log("Reconnect response:", response);

            // Reset flag to allow reconnect on next disconnect
            reconnectAttemptedRef.current = false;

            if (response.status === "activated") {
              setAuthStatus(AUTH_STATUSES.awaiting);
            }
            handleMessage(response);
          } catch (err) {
            log("Reconnect failed:", err);
            setAuthStatus(AUTH_STATUSES.reconnect_failed);
          }
        },
        onMessage: handleMessage,
      });

      try {
        await socket.open();

        const msg = await socket.send({ _: SOCKET_MESSAGES.AUTH_INIT });
        if (msg?._ === SOCKET_MESSAGES.AUTH_INIT && msg?.linkWeb) {
          setLink(msg.linkWeb);
          // Save sessionId for reconnect
          if (msg.sessionId) {
            sessionIdRef.current = msg.sessionId;
            log("Saved sessionId for reconnect:", msg.sessionId);
          }
        }

        socketRef.current = socket;
      } catch (err) {
        log("WS init/auth error:", err);

        setAuthStatus(AUTH_STATUSES.error);
        setClosing(true);

        try {
          socket.close();
        } catch (closeError) {
          log("[initializeSocket] socket close failed", closeError);
        }
      }
    },
    [callbacks, setClosing]
  );

  useEffect(() => {
    if (backendUrl) {
      initializeSocket(backendUrl);
    }

    return () => socketRef.current?.close();
  }, [backendUrl]);

  const contextValue = {
    setBackendUrl,
    authStatus,
    link,
  };

  return (
    <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>
  );
};
