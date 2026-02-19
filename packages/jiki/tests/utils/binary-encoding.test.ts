import { describe, it, expect } from "vitest";
import {
  uint8ToBase64,
  base64ToUint8,
  uint8ToHex,
  uint8ToBinaryString,
} from "../../src/utils/binary-encoding";

describe("binary-encoding", () => {
  describe("uint8ToBase64 / base64ToUint8 round-trip", () => {
    it("handles empty data", () => {
      const data = new Uint8Array(0);
      expect(base64ToUint8(uint8ToBase64(data))).toEqual(data);
    });

    it("handles small data", () => {
      const data = new Uint8Array([72, 101, 108, 108, 111]);
      const roundTrip = base64ToUint8(uint8ToBase64(data));
      expect(roundTrip).toEqual(data);
    });

    it("handles data larger than chunk size (>8192)", () => {
      const data = new Uint8Array(10000);
      for (let i = 0; i < data.length; i++) data[i] = i % 256;
      const roundTrip = base64ToUint8(uint8ToBase64(data));
      expect(roundTrip).toEqual(data);
    });
  });

  describe("uint8ToHex", () => {
    it("converts bytes to hex", () => {
      expect(uint8ToHex(new Uint8Array([0, 15, 255]))).toBe("000fff");
    });

    it("handles empty array", () => {
      expect(uint8ToHex(new Uint8Array(0))).toBe("");
    });
  });

  describe("uint8ToBinaryString", () => {
    it("produces correct latin1 string", () => {
      const data = new Uint8Array([65, 66, 67]);
      expect(uint8ToBinaryString(data)).toBe("ABC");
    });

    it("handles high bytes", () => {
      const data = new Uint8Array([255, 0, 128]);
      const result = uint8ToBinaryString(data);
      expect(result.charCodeAt(0)).toBe(255);
      expect(result.charCodeAt(1)).toBe(0);
      expect(result.charCodeAt(2)).toBe(128);
    });
  });
});
