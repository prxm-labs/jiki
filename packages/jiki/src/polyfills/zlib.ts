import pako from "pako";
import { BufferImpl, Transform } from "./stream";

export function gzipSync(data: string | Uint8Array): BufferImpl {
  const input =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return BufferImpl.from(pako.gzip(input));
}

export function gunzipSync(data: Uint8Array): BufferImpl {
  return BufferImpl.from(pako.ungzip(data));
}

export function deflateSync(data: string | Uint8Array): BufferImpl {
  const input =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return BufferImpl.from(pako.deflate(input));
}

export function inflateSync(data: Uint8Array): BufferImpl {
  return BufferImpl.from(pako.inflate(data));
}

export function deflateRawSync(data: string | Uint8Array): BufferImpl {
  const input =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  return BufferImpl.from(pako.deflateRaw(input));
}

export function inflateRawSync(data: Uint8Array): BufferImpl {
  return BufferImpl.from(pako.inflateRaw(data));
}

export function gzip(
  data: string | Uint8Array,
  cb: (err: Error | null, result?: BufferImpl) => void,
): void {
  try {
    cb(null, gzipSync(data));
  } catch (e) {
    cb(e as Error);
  }
}

export function gunzip(
  data: Uint8Array,
  cb: (err: Error | null, result?: BufferImpl) => void,
): void {
  try {
    cb(null, gunzipSync(data));
  } catch (e) {
    cb(e as Error);
  }
}

export function deflate(
  data: string | Uint8Array,
  cb: (err: Error | null, result?: BufferImpl) => void,
): void {
  try {
    cb(null, deflateSync(data));
  } catch (e) {
    cb(e as Error);
  }
}

export function inflate(
  data: Uint8Array,
  cb: (err: Error | null, result?: BufferImpl) => void,
): void {
  try {
    cb(null, inflateSync(data));
  } catch (e) {
    cb(e as Error);
  }
}

export function unzipSync(data: Uint8Array): BufferImpl {
  try {
    return gunzipSync(data);
  } catch {
    return inflateSync(data);
  }
}

export function unzip(
  data: Uint8Array,
  cb: (err: Error | null, result?: BufferImpl) => void,
): void {
  try {
    cb(null, unzipSync(data));
  } catch (e) {
    cb(e as Error);
  }
}

class ZlibTransform extends Transform {
  private processor: pako.Deflate | pako.Inflate;
  private _chunks: Uint8Array[] = [];

  constructor(processor: pako.Deflate | pako.Inflate) {
    super();
    this.processor = processor;
    // pako calls onData for each output chunk during push()
    (this.processor as any).onData = (chunk: Uint8Array) => {
      this._chunks.push(chunk);
    };
  }

  _transform(
    chunk: unknown,
    _encoding: string,
    callback: (err?: Error | null, data?: unknown) => void,
  ): void {
    try {
      const input =
        chunk instanceof Uint8Array
          ? chunk
          : new TextEncoder().encode(String(chunk));
      this._chunks = [];
      this.processor.push(input, false);
      // Emit any chunks produced by onData callback
      for (const c of this._chunks) {
        this.push(c);
      }
      callback();
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  }

  _flush(callback: (err?: Error | null, data?: unknown) => void): void {
    try {
      this._chunks = [];
      this.processor.push(new Uint8Array(0), true); // finalize
      // Emit final chunks produced by onData callback
      for (const c of this._chunks) {
        this.push(c);
      }
      callback();
    } catch (err) {
      callback(err instanceof Error ? err : new Error(String(err)));
    }
  }

  end(
    chunkOrCb?: unknown,
    encodingOrCb?: string | (() => void),
    cb?: () => void,
  ): this {
    if (this.writableEnded) return this;
    // Handle the case where first arg is a callback
    if (typeof chunkOrCb === "function") {
      cb = chunkOrCb as () => void;
      chunkOrCb = undefined;
    }
    this.writableEnded = true;
    // Write any final chunk
    if (chunkOrCb != null) {
      this.write(chunkOrCb as string | Uint8Array, encodingOrCb as string);
    }
    // Call _flush to finalize compression/decompression
    this._flush(err => {
      if (err) {
        this.emit("error", err);
      }
      // Signal end of readable stream
      this.push(null);
      this.writableFinished = true;
      this.emit("finish");
      this.emit("close");
      if (cb) cb();
      if (typeof encodingOrCb === "function") encodingOrCb();
    });
    return this;
  }
}

export function createGzip() {
  return new ZlibTransform(new pako.Deflate({ gzip: true }));
}
export function createGunzip() {
  return new ZlibTransform(new pako.Inflate());
}
export function createDeflate() {
  return new ZlibTransform(new pako.Deflate());
}
export function createInflate() {
  return new ZlibTransform(new pako.Inflate());
}

export function brotliCompressSync(data: string | Uint8Array): BufferImpl {
  const input =
    typeof data === "string" ? new TextEncoder().encode(data) : data;
  // Use pako deflate as brotli substitute (actual brotli needs wasm/native)
  const compressed = pako.deflate(input);
  return BufferImpl.from(compressed);
}
export function brotliDecompressSync(data: Uint8Array): BufferImpl {
  const decompressed = pako.inflate(data);
  return BufferImpl.from(decompressed);
}

export const constants = {
  Z_NO_FLUSH: 0,
  Z_PARTIAL_FLUSH: 1,
  Z_SYNC_FLUSH: 2,
  Z_FULL_FLUSH: 3,
  Z_FINISH: 4,
  Z_OK: 0,
  Z_STREAM_END: 1,
  Z_NEED_DICT: 2,
  Z_ERRNO: -1,
  Z_STREAM_ERROR: -2,
  Z_DEFAULT_COMPRESSION: -1,
  Z_BEST_SPEED: 1,
  Z_BEST_COMPRESSION: 9,
  Z_NO_COMPRESSION: 0,
  BROTLI_OPERATION_PROCESS: 0,
  BROTLI_OPERATION_FLUSH: 1,
  BROTLI_OPERATION_FINISH: 2,
};

export default {
  gzip,
  gzipSync,
  gunzip,
  gunzipSync,
  deflate,
  deflateSync,
  inflate,
  inflateSync,
  deflateRawSync,
  inflateRawSync,
  unzip,
  unzipSync,
  brotliCompressSync,
  brotliDecompressSync,
  createGzip,
  createGunzip,
  createDeflate,
  createInflate,
  constants,
};
