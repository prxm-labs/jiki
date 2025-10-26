import { Readable, Writable } from "./stream";

export class ReadStream extends Readable {
  isTTY = true;
  isRaw = false;
  setRawMode(mode: boolean): this {
    this.isRaw = mode;
    return this;
  }
}

export class WriteStream extends Writable {
  isTTY = true;
  columns = 80;
  rows = 24;
  getColorDepth(): number {
    return 8;
  }
  hasColors(count?: number): boolean {
    return (count || 1) <= 256;
  }
  getWindowSize(): [number, number] {
    return [this.columns, this.rows];
  }
  clearLine(_dir: number, _cb?: () => void): boolean {
    return true;
  }
  clearScreenDown(_cb?: () => void): boolean {
    return true;
  }
  cursorTo(_x: number, _y?: number, _cb?: () => void): boolean {
    return true;
  }
  moveCursor(_dx: number, _dy: number, _cb?: () => void): boolean {
    return true;
  }
}

export function isatty(_fd: number): boolean {
  return false;
}

export default { ReadStream, WriteStream, isatty };
