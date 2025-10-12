import { EventEmitter } from "./events";

const BUFFER_POOL_SIZE = 8192;

export class BufferImpl extends Uint8Array {
  static alloc(size: number, fill?: number): BufferImpl {
    const buf = new BufferImpl(size);
    if (fill !== undefined) buf.fill(fill);
    return buf;
  }
  static allocUnsafe(size: number): BufferImpl {
    return new BufferImpl(size);
  }
  static allocUnsafeSlow(size: number): BufferImpl {
    return new BufferImpl(size);
  }
  static override from(
    data:
      | string
      | ArrayBuffer
      | ArrayLike<number>
      | Uint8Array
      | Iterable<number>,
    encoding?: string | ((v: any, k: number) => number),
    thisArg?: any,
  ): BufferImpl {
    if (typeof data === "string") {
      if (encoding === "base64") {
        const binary = atob(data);
        const buf = new BufferImpl(binary.length);
        for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
        return buf;
      }
      if (encoding === "hex") {
        const buf = new BufferImpl(data.length / 2);
        for (let i = 0; i < data.length; i += 2)
          buf[i / 2] = parseInt(data.substring(i, i + 2), 16);
        return buf;
      }
      return new BufferImpl(new TextEncoder().encode(data));
    }
    if (data instanceof ArrayBuffer) return new BufferImpl(data);
    if (data instanceof Uint8Array) return new BufferImpl(data);
    if (Array.isArray(data)) return new BufferImpl(data);
    if (typeof (data as any)[Symbol.iterator] === "function")
      return new BufferImpl(Array.from(data as Iterable<number>));
    return new BufferImpl(data as ArrayLike<number>);
  }
  static concat(
    list: (Uint8Array | BufferImpl)[],
    totalLength?: number,
  ): BufferImpl {
    const len = totalLength ?? list.reduce((s, b) => s + b.length, 0);
    const result = new BufferImpl(len);
    let offset = 0;
    for (const buf of list) {
      const remaining = len - offset;
      if (remaining <= 0) break;
      const toCopy = buf.length <= remaining ? buf : buf.subarray(0, remaining);
      result.set(toCopy, offset);
      offset += toCopy.length;
    }
    return result;
  }
  static isBuffer(obj: unknown): obj is BufferImpl {
    return obj instanceof BufferImpl || obj instanceof Uint8Array;
  }
  static isEncoding(encoding: string): boolean {
    return [
      "utf8",
      "utf-8",
      "ascii",
      "latin1",
      "binary",
      "base64",
      "hex",
      "ucs2",
      "ucs-2",
      "utf16le",
    ].includes(encoding);
  }
  static byteLength(str: string, encoding?: string): number {
    if (encoding === "base64") return Math.ceil((str.length * 3) / 4);
    if (encoding === "hex") return str.length / 2;
    return new TextEncoder().encode(str).length;
  }

  toString(encoding?: string, start?: number, end?: number): string {
    const slice = this.subarray(start || 0, end || this.length);
    if (encoding === "base64") {
      let binary = "";
      for (let i = 0; i < slice.length; i += BUFFER_POOL_SIZE) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(slice.subarray(i, i + BUFFER_POOL_SIZE)),
        );
      }
      return btoa(binary);
    }
    if (encoding === "hex") {
      return Array.from(slice)
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }
    if (encoding === "latin1" || encoding === "binary") {
      return Array.from(slice)
        .map(b => String.fromCharCode(b))
        .join("");
    }
    return new TextDecoder().decode(slice);
  }

  write(
    string: string,
    offset?: number,
    length?: number,
    encoding?: string,
  ): number {
    const bytes = BufferImpl.from(string, encoding);
    const start = offset || 0;
    const count = Math.min(
      bytes.length,
      length ?? this.length - start,
      this.length - start,
    );
    this.set(bytes.subarray(0, count), start);
    return count;
  }

  copy(
    target: Uint8Array,
    targetStart = 0,
    sourceStart = 0,
    sourceEnd = this.length,
  ): number {
    const slice = this.subarray(sourceStart, sourceEnd);
    const count = Math.min(slice.length, target.length - targetStart);
    target.set(slice.subarray(0, count), targetStart);
    return count;
  }

  equals(other: Uint8Array): boolean {
    if (this.length !== other.length) return false;
    for (let i = 0; i < this.length; i++) {
      if (this[i] !== other[i]) return false;
    }
    return true;
  }

  compare(other: Uint8Array): number {
    const len = Math.min(this.length, other.length);
    for (let i = 0; i < len; i++) {
      if (this[i] < other[i]) return -1;
      if (this[i] > other[i]) return 1;
    }
    if (this.length < other.length) return -1;
    if (this.length > other.length) return 1;
    return 0;
  }

  readUInt8(offset: number): number {
    return this[offset];
  }
  readUInt16BE(offset: number): number {
    return (this[offset] << 8) | this[offset + 1];
  }
  readUInt16LE(offset: number): number {
    return this[offset] | (this[offset + 1] << 8);
  }
  readUInt32BE(offset: number): number {
    return (
      ((this[offset] << 24) |
        (this[offset + 1] << 16) |
        (this[offset + 2] << 8) |
        this[offset + 3]) >>>
      0
    );
  }
  readUInt32LE(offset: number): number {
    return (
      (this[offset] |
        (this[offset + 1] << 8) |
        (this[offset + 2] << 16) |
        (this[offset + 3] << 24)) >>>
      0
    );
  }
  readInt8(offset: number): number {
    const v = this[offset];
    return v > 127 ? v - 256 : v;
  }
  readInt16BE(offset: number): number {
    const v = this.readUInt16BE(offset);
    return v > 32767 ? v - 65536 : v;
  }
  readInt16LE(offset: number): number {
    const v = this.readUInt16LE(offset);
    return v > 32767 ? v - 65536 : v;
  }
  readInt32BE(offset: number): number {
    return (
      (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3]
    );
  }
  readInt32LE(offset: number): number {
    return (
      this[offset] |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
    );
  }

  writeUInt8(value: number, offset: number): number {
    this[offset] = value & 0xff;
    return offset + 1;
  }
  writeUInt16BE(value: number, offset: number): number {
    this[offset] = (value >> 8) & 0xff;
    this[offset + 1] = value & 0xff;
    return offset + 2;
  }
  writeUInt16LE(value: number, offset: number): number {
    this[offset] = value & 0xff;
    this[offset + 1] = (value >> 8) & 0xff;
    return offset + 2;
  }
  writeUInt32BE(value: number, offset: number): number {
    this[offset] = (value >>> 24) & 0xff;
    this[offset + 1] = (value >>> 16) & 0xff;
    this[offset + 2] = (value >>> 8) & 0xff;
    this[offset + 3] = value & 0xff;
    return offset + 4;
  }
  writeUInt32LE(value: number, offset: number): number {
    this[offset] = value & 0xff;
    this[offset + 1] = (value >>> 8) & 0xff;
    this[offset + 2] = (value >>> 16) & 0xff;
    this[offset + 3] = (value >>> 24) & 0xff;
    return offset + 4;
  }

  readFloatBE(offset: number): number {
    return new DataView(
      this.buffer,
      this.byteOffset,
      this.byteLength,
    ).getFloat32(offset, false);
  }
  readFloatLE(offset: number): number {
    return new DataView(
      this.buffer,
      this.byteOffset,
      this.byteLength,
    ).getFloat32(offset, true);
  }
  readDoubleBE(offset: number): number {
    return new DataView(
      this.buffer,
      this.byteOffset,
      this.byteLength,
    ).getFloat64(offset, false);
  }
  readDoubleLE(offset: number): number {
    return new DataView(
      this.buffer,
      this.byteOffset,
      this.byteLength,
    ).getFloat64(offset, true);
  }
  writeFloatBE(value: number, offset: number): number {
    new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat32(
      offset,
      value,
      false,
    );
    return offset + 4;
  }
  writeFloatLE(value: number, offset: number): number {
    new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat32(
      offset,
      value,
      true,
    );
    return offset + 4;
  }
  writeDoubleBE(value: number, offset: number): number {
    new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat64(
      offset,
      value,
      false,
    );
    return offset + 8;
  }
  writeDoubleLE(value: number, offset: number): number {
    new DataView(this.buffer, this.byteOffset, this.byteLength).setFloat64(
      offset,
      value,
      true,
    );
    return offset + 8;
  }

  toJSON(): { type: "Buffer"; data: number[] } {
    return { type: "Buffer", data: Array.from(this) };
  }

  slice(start?: number, end?: number): BufferImpl {
    const sliced = super.slice(start, end);
    return new BufferImpl(sliced);
  }
}

export class Readable extends EventEmitter {
  readable = true;
  readableEnded = false;
  readableFlowing: boolean | null = null;
  private _buffer: unknown[] = [];
  private _ended = false;

  readableHighWaterMark = 16;

  read(_size?: number): unknown {
    return this._buffer.shift() || null;
  }

  push(chunk: unknown): boolean {
    if (chunk === null) {
      this._ended = true;
      this.readableEnded = true;
      this.emit("end");
      return false;
    }
    this._buffer.push(chunk);
    if (this.readableFlowing) {
      while (this._buffer.length > 0) {
        this.emit("data", this._buffer.shift());
      }
    }
    return this._buffer.length < this.readableHighWaterMark;
  }

  on(event: string, listener: (...args: unknown[]) => void): this {
    super.on(event, listener);
    if (event === "data" && this.readableFlowing === null) {
      this.readableFlowing = true;
      // Flush any buffered data
      while (this._buffer.length > 0 && this.readableFlowing) {
        this.emit("data", this._buffer.shift());
      }
    }
    return this;
  }

  pipe<T extends Writable>(dest: T): T {
    this.on("data", chunk => dest.write(chunk as string | Uint8Array));
    this.on("end", () => dest.end?.());
    return dest;
  }

  unpipe(_dest?: Writable): this {
    return this;
  }
  pause(): this {
    this.readableFlowing = false;
    return this;
  }
  resume(): this {
    if (!this.readableFlowing) {
      this.readableFlowing = true;
      // Flush buffered chunks
      while (this._buffer.length > 0 && this.readableFlowing) {
        this.emit("data", this._buffer.shift());
      }
      if (this.readableEnded && this._buffer.length === 0) {
        this.emit("end");
      }
    }
    return this;
  }
  destroy(): this {
    this.readable = false;
    this.emit("close");
    return this;
  }
  setEncoding(_enc: string): this {
    return this;
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<unknown> {
    const self = this;
    return {
      next(): Promise<IteratorResult<unknown>> {
        return new Promise(resolve => {
          if (self._ended) {
            resolve({ value: undefined, done: true });
            return;
          }
          const chunk = self.read();
          if (chunk !== null) {
            resolve({ value: chunk, done: false });
            return;
          }
          const onData = (data: unknown) => {
            self.removeListener("end", onEnd);
            resolve({ value: data, done: false });
          };
          const onEnd = () => {
            self.removeListener("data", onData);
            resolve({ value: undefined, done: true });
          };
          self.once("data", onData);
          self.once("end", onEnd);
        });
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    };
  }
}

export class Writable extends EventEmitter {
  writable = true;
  writableEnded = false;
  writableFinished = false;

  write(
    chunk: string | Uint8Array,
    encodingOrCb?: string | (() => void),
    cb?: () => void,
  ): boolean {
    const callback = typeof encodingOrCb === "function" ? encodingOrCb : cb;
    this._write(
      chunk,
      typeof encodingOrCb === "string" ? encodingOrCb : "utf8",
      callback || (() => {}),
    );
    return true;
  }

  _write(_chunk: unknown, _encoding: string, callback: () => void): void {
    callback();
  }

  end(
    chunkOrCb?: unknown,
    encodingOrCb?: string | (() => void),
    cb?: () => void,
  ): this {
    if (typeof chunkOrCb === "function") {
      cb = chunkOrCb as () => void;
    } else if (chunkOrCb != null) {
      this.write(chunkOrCb as string | Uint8Array, encodingOrCb as string);
    }
    this.writableEnded = true;
    this.writableFinished = true;
    this.emit("finish");
    this.emit("close");
    if (cb) cb();
    if (typeof encodingOrCb === "function") encodingOrCb();
    return this;
  }

  destroy(): this {
    this.writable = false;
    this.emit("close");
    return this;
  }
}

export class Duplex extends Readable {
  writable = true;
  writableEnded = false;
  writableFinished = false;

  write(
    chunk: string | Uint8Array,
    encodingOrCb?: string | (() => void),
    cb?: () => void,
  ): boolean {
    const callback = typeof encodingOrCb === "function" ? encodingOrCb : cb;
    this._write(
      chunk,
      typeof encodingOrCb === "string" ? encodingOrCb : "utf8",
      callback || (() => {}),
    );
    return true;
  }

  _write(_chunk: unknown, _encoding: string, callback: () => void): void {
    callback();
  }

  end(
    chunkOrCb?: unknown,
    encodingOrCb?: string | (() => void),
    cb?: () => void,
  ): this {
    if (typeof chunkOrCb === "function") {
      cb = chunkOrCb as () => void;
    } else if (chunkOrCb != null) {
      this.write(chunkOrCb as string | Uint8Array, encodingOrCb as string);
    }
    this.writableEnded = true;
    this.writableFinished = true;
    this.emit("finish");
    this.emit("close");
    if (cb) cb();
    if (typeof encodingOrCb === "function") encodingOrCb();
    return this;
  }
}

export class Transform extends Duplex {
  _transform(
    chunk: unknown,
    _encoding: string,
    callback: (err?: Error | null, data?: unknown) => void,
  ): void {
    callback(null, chunk);
  }

  _write(chunk: unknown, encoding: string, callback: () => void): void {
    this._transform(chunk, encoding, (err, data) => {
      if (data != null) this.push(data);
      if (err) this.emit("error", err);
      callback();
    });
  }
}

export class PassThrough extends Transform {}

export function pipeline(...args: unknown[]): unknown {
  const cb =
    typeof args[args.length - 1] === "function"
      ? (args.pop() as (err?: Error) => void)
      : undefined;
  const streams = args as (Readable | Writable | Transform)[];
  let current: unknown = streams[0];
  for (let i = 1; i < streams.length; i++) {
    current = (current as Readable).pipe(streams[i] as Writable);
  }
  if (cb) {
    const last = streams[streams.length - 1];
    (last as EventEmitter).on("finish", () => cb());
    (last as EventEmitter).on("error", err => cb(err as Error));
  }
  return current;
}

export function finished(
  stream: unknown,
  cb: (err?: Error) => void,
): () => void {
  const s = stream as EventEmitter;
  const onFinish = () => {
    cleanup();
    cb();
  };
  const onError = (err: Error) => {
    cleanup();
    cb(err);
  };
  const onEnd = () => {
    cleanup();
    cb();
  };
  const cleanup = () => {
    s.removeListener("finish", onFinish);
    s.removeListener("error", onError);
    s.removeListener("end", onEnd);
  };
  s.on("finish", onFinish);
  s.on("error", onError);
  s.on("end", onEnd);
  return cleanup;
}

export { BufferImpl as Buffer };

export const bufferModule = { Buffer: BufferImpl };

export class Stream extends EventEmitter {
  pipe<T extends Writable>(dest: T): T {
    this.on("data", (chunk: unknown) =>
      dest.write(chunk as string | Uint8Array),
    );
    this.on("end", () => dest.end?.());
    return dest;
  }
}

const streamModule = Object.assign(Stream, {
  Readable,
  Writable,
  Duplex,
  Transform,
  PassThrough,
  pipeline,
  finished,
  Stream,
  Buffer: BufferImpl,
});

export default streamModule;
