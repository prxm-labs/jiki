import { EventEmitter } from "./events";

export class WebSocketShim extends EventEmitter {
  readyState = 0;
  url: string;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  CONNECTING = 0;
  OPEN = 1;
  CLOSING = 2;
  CLOSED = 3;

  private _ws: WebSocket | null = null;

  constructor(url: string, _protocols?: string | string[], _options?: unknown) {
    super();
    this.url = url;
    try {
      this._ws = new WebSocket(url);
      this._ws.binaryType = "arraybuffer";
      this._ws.onopen = () => {
        this.readyState = 1;
        this.emit("open");
      };
      this._ws.onmessage = e => this.emit("message", e.data);
      this._ws.onerror = e => this.emit("error", e);
      this._ws.onclose = e => {
        this.readyState = 3;
        this.emit("close", e.code, e.reason);
      };
    } catch (err) {
      setTimeout(() => this.emit("error", err), 0);
    }
  }

  send(data: unknown, _options?: unknown, cb?: (err?: Error) => void): void {
    try {
      this._ws?.send(data as string | ArrayBuffer);
      cb?.();
    } catch (err) {
      cb?.(err as Error);
    }
  }

  close(code?: number, reason?: string): void {
    this.readyState = 2;
    this._ws?.close(code, reason);
  }

  ping(_data?: unknown, _mask?: boolean, _cb?: () => void): void {}
  pong(_data?: unknown, _mask?: boolean, _cb?: () => void): void {}
  terminate(): void {
    this.close();
  }
}

export class WebSocketServer extends EventEmitter {
  clients = new Set<WebSocketShim>();
  constructor(_options?: unknown) {
    super();
  }
  close(_cb?: () => void): void {
    this.emit("close");
  }
  address(): { port: number; family: string; address: string } {
    return { port: 0, family: "IPv4", address: "0.0.0.0" };
  }
}

export { WebSocketShim as WebSocket };
export default WebSocketShim;
