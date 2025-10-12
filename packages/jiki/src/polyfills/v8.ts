export function getHeapStatistics(): Record<string, number> {
  return {
    total_heap_size: 30 * 1024 * 1024,
    used_heap_size: 20 * 1024 * 1024,
    heap_size_limit: 512 * 1024 * 1024,
    total_physical_size: 30 * 1024 * 1024,
    total_available_size: 400 * 1024 * 1024,
    malloced_memory: 0,
    peak_malloced_memory: 0,
    does_zap_garbage: 0,
    number_of_native_contexts: 1,
    number_of_detached_contexts: 0,
    total_global_handles_size: 0,
    used_global_handles_size: 0,
    external_memory: 0,
  };
}
export function getHeapSpaceStatistics(): Record<string, unknown>[] {
  return [];
}
export function getHeapSnapshot(): unknown {
  return {
    toString() {
      return "{}";
    },
  };
}
export function writeHeapSnapshot(_filename?: string): string {
  return "";
}
export function setFlagsFromString(_flags: string): void {}
export function serialize(value: unknown): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(value));
}
export function deserialize(buffer: Uint8Array): unknown {
  return JSON.parse(new TextDecoder().decode(buffer));
}
export const DefaultSerializer = class {
  writeHeader() {}
  writeValue(_v: unknown) {}
  releaseBuffer() {
    return new Uint8Array(0);
  }
};
export const DefaultDeserializer = class {
  constructor(_buf: Uint8Array) {}
  readHeader() {}
  readValue() {
    return null;
  }
};
export default {
  getHeapStatistics,
  getHeapSpaceStatistics,
  getHeapSnapshot,
  writeHeapSnapshot,
  setFlagsFromString,
  serialize,
  deserialize,
  DefaultSerializer,
  DefaultDeserializer,
};
