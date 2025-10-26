import { EventEmitter } from "./events";

export class Interface extends EventEmitter {
  private _input: unknown;
  private _output: unknown;
  terminal: boolean;

  constructor(options?: {
    input?: unknown;
    output?: unknown;
    terminal?: boolean;
  }) {
    super();
    this._input = options?.input;
    this._output = options?.output;
    this.terminal = options?.terminal ?? false;
  }

  question(query: string, cb: (answer: string) => void): void {
    if (this._output && typeof (this._output as any).write === "function") {
      (this._output as any).write(query);
    }
    cb("");
  }

  close(): void {
    this.emit("close");
  }
  pause(): this {
    return this;
  }
  resume(): this {
    return this;
  }
  prompt(_preserveCursor?: boolean): void {}
  setPrompt(_prompt: string): void {}
  write(_data: string): void {}
}

export function createInterface(options?: unknown): Interface {
  return new Interface(
    options as { input?: unknown; output?: unknown; terminal?: boolean },
  );
}

export function clearLine(
  _stream: unknown,
  _dir: number,
  _cb?: () => void,
): boolean {
  return true;
}
export function clearScreenDown(_stream: unknown, _cb?: () => void): boolean {
  return true;
}
export function cursorTo(
  _stream: unknown,
  _x: number,
  _y?: number,
  _cb?: () => void,
): boolean {
  return true;
}
export function moveCursor(
  _stream: unknown,
  _dx: number,
  _dy: number,
  _cb?: () => void,
): boolean {
  return true;
}

export default {
  Interface,
  createInterface,
  clearLine,
  clearScreenDown,
  cursorTo,
  moveCursor,
};
