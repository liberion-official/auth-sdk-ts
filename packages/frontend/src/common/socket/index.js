import { encode, decode } from "@msgpack/msgpack";
import { log, logError } from "@/common/utils";

export class LiberionSocket {
  constructor({ address, onClose, onMessage }) {
    this.address = address;
    this.onClose = onClose;
    this.onMessage = onMessage;
    this.resolver = null;
    this.rejector = null;
  }

  encode(data) {
    return encode(data);
  }
  decode(data) {
    return decode(data);
  }

  open() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.address);
      this.ws.binaryType = "arraybuffer";

      this.ws.onopen = (event) => resolve(event.target);

      this.ws.onclose = (event) => {
        if (this.rejector && event.code !== 1000) {
          this.rejector(new Error("Connection closed"));
        }
        this.rejector = null;
        this.resolver = null;

        try {
          const reason =
            !!event.reason && typeof event.reason === "string"
              ? JSON.parse(event.reason)
              : null;
          if (reason && reason._ === "error") {
            this.onMessage?.(reason);
          }
        } catch (error) {
          logError("[Socket] onclose reason parse failed", error);
        }

        this.onClose?.(event);
      };

      this.ws.onmessage = (event) => {
        const resolver = this.resolver;
        const rejector = this.rejector;
        this.resolver = null;
        this.rejector = null;

        try {
          const json = this.decode(event.data);
          log("[Socket].onmessage", { json });

          if (json._ === "error") {
            if (rejector) {
              rejector(new Error(json.message ?? "Server error"));
            } else {
              this.onMessage?.(json);
            }
            return;
          }

          if (resolver) {
            resolver(json);
          } else {
            this.onMessage?.(json);
          }
        } catch (error) {
          logError("[Socket].onmessage", error);
          rejector?.(new Error("Bad server response"));
        }
      };

      this.ws.onerror = () => {
        reject(new Error(`Connection to ${this.address} failed`));
      };
    });
  }

  close() {
    if (!this.ws) return;
    if (
      this.ws.readyState === WebSocket.OPEN ||
      this.ws.readyState === WebSocket.CONNECTING
    ) {
      this.ws.close();
    }
  }

  reconnect() {
    log("[Socket].reconnect Attempting to reconnect");
    return this.open();
  }
  send(data, { timeout = 15000 } = {}) {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState !== WebSocket.OPEN) {
        return reject(new Error("Websocket is closed"));
      }

      const timer = setTimeout(() => {
        this.resolver = null;
        this.rejector = null;
        reject(new Error("Request timed out"));
      }, timeout);

      this.resolver = (payload) => {
        clearTimeout(timer);
        this.resolver = null;
        this.rejector = null;
        resolve(payload);
      };

      this.rejector = (error) => {
        clearTimeout(timer);
        log("[Socket].rejector", error);
        this.resolver = null;
        this.rejector = null;
        reject(error);
      };

      try {
        this.ws.send(this.encode(data));
      } catch (error) {
        this.rejector(error);
      }
    });
  }
}
