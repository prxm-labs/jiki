import { describe, it, expect } from "vitest";
import { BufferImpl } from "../../src/polyfills/stream";

describe("Buffer float/double methods", () => {
  describe("readFloatBE / writeFloatBE", () => {
    it("round-trips a float value in big-endian", () => {
      const buf = BufferImpl.alloc(4);
      buf.writeFloatBE(3.14, 0);
      expect(buf.readFloatBE(0)).toBeCloseTo(3.14, 2);
    });

    it("writeFloatBE returns offset + 4", () => {
      const buf = BufferImpl.alloc(8);
      expect(buf.writeFloatBE(1.0, 0)).toBe(4);
      expect(buf.writeFloatBE(2.0, 4)).toBe(8);
    });
  });

  describe("readFloatLE / writeFloatLE", () => {
    it("round-trips a float value in little-endian", () => {
      const buf = BufferImpl.alloc(4);
      buf.writeFloatLE(2.5, 0);
      expect(buf.readFloatLE(0)).toBeCloseTo(2.5, 5);
    });

    it("writeFloatLE returns offset + 4", () => {
      const buf = BufferImpl.alloc(4);
      expect(buf.writeFloatLE(1.0, 0)).toBe(4);
    });
  });

  describe("readDoubleBE / writeDoubleBE", () => {
    it("round-trips a double value in big-endian", () => {
      const buf = BufferImpl.alloc(8);
      buf.writeDoubleBE(Math.PI, 0);
      expect(buf.readDoubleBE(0)).toBeCloseTo(Math.PI, 10);
    });

    it("writeDoubleBE returns offset + 8", () => {
      const buf = BufferImpl.alloc(8);
      expect(buf.writeDoubleBE(1.0, 0)).toBe(8);
    });
  });

  describe("readDoubleLE / writeDoubleLE", () => {
    it("round-trips a double value in little-endian", () => {
      const buf = BufferImpl.alloc(8);
      buf.writeDoubleLE(Math.E, 0);
      expect(buf.readDoubleLE(0)).toBeCloseTo(Math.E, 10);
    });

    it("writeDoubleLE returns offset + 8", () => {
      const buf = BufferImpl.alloc(8);
      expect(buf.writeDoubleLE(1.0, 0)).toBe(8);
    });
  });

  describe("endianness matters", () => {
    it("BE and LE produce different byte layouts for the same float", () => {
      const be = BufferImpl.alloc(4);
      const le = BufferImpl.alloc(4);
      be.writeFloatBE(42.5, 0);
      le.writeFloatLE(42.5, 0);
      // The bytes should be reversed
      expect(be[0]).toBe(le[3]);
      expect(be[1]).toBe(le[2]);
      expect(be[2]).toBe(le[1]);
      expect(be[3]).toBe(le[0]);
    });

    it("BE and LE produce different byte layouts for the same double", () => {
      const be = BufferImpl.alloc(8);
      const le = BufferImpl.alloc(8);
      be.writeDoubleBE(42.5, 0);
      le.writeDoubleLE(42.5, 0);
      for (let i = 0; i < 8; i++) {
        expect(be[i]).toBe(le[7 - i]);
      }
    });
  });

  describe("negative values", () => {
    it("handles negative floats", () => {
      const buf = BufferImpl.alloc(4);
      buf.writeFloatLE(-99.99, 0);
      expect(buf.readFloatLE(0)).toBeCloseTo(-99.99, 2);
    });

    it("handles negative doubles", () => {
      const buf = BufferImpl.alloc(8);
      buf.writeDoubleLE(-123456.789, 0);
      expect(buf.readDoubleLE(0)).toBeCloseTo(-123456.789, 3);
    });
  });

  describe("offset positioning", () => {
    it("reads/writes float at non-zero offset", () => {
      const buf = BufferImpl.alloc(8);
      buf.writeFloatLE(7.5, 4);
      expect(buf.readFloatLE(4)).toBeCloseTo(7.5, 5);
      // First 4 bytes should still be zero
      expect(buf.readFloatLE(0)).toBe(0);
    });

    it("reads/writes double at non-zero offset", () => {
      const buf = BufferImpl.alloc(16);
      buf.writeDoubleLE(7.5, 8);
      expect(buf.readDoubleLE(8)).toBeCloseTo(7.5, 10);
      expect(buf.readDoubleLE(0)).toBe(0);
    });
  });
});
