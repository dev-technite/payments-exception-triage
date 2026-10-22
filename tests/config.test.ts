import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("uses port 3000 and a working settlement when nothing is set", () => {
    expect(loadConfig({})).toEqual({ port: 3000, settlementFail: false });
  });

  it("reads the port from PORT", () => {
    expect(loadConfig({ PORT: "8080" }).port).toBe(8080);
  });

  it("forces settlement to fail only when SETTLEMENT_FAIL is exactly true", () => {
    expect(loadConfig({ SETTLEMENT_FAIL: "true" }).settlementFail).toBe(true);
  });

  it.each(["false", "TRUE", "1", "yes", ""])(
    "keeps settlement working when SETTLEMENT_FAIL is %j",
    (value) => {
      expect(loadConfig({ SETTLEMENT_FAIL: value }).settlementFail).toBe(false);
    },
  );

  it.each(["abc", "0", "-1", "70000", "3.5", "80 80", ""])(
    "rejects an invalid PORT %j with a clear message",
    (port) => {
      expect(() => loadConfig({ PORT: port })).toThrow("PORT must be a whole number between 1 and 65535");
    },
  );
});
