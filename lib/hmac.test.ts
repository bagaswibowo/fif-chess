import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { passwordMatches } from "@/lib/gate";
import { hmacSha256Hex } from "@/lib/hmac";

const KEY_ENV = "SITE_HMAC_KEY";
const MAC_ENV = "SITE_PASSWORD_HMAC";
const KEY = "0123456789abcdef0123456789abcdef";
const PASSWORD = "fixture-password";

function nodeMac(key: string, message: string): string {
  return createHmac("sha256", key).update(message, "utf8").digest("hex");
}

const saved = {
  key: process.env[KEY_ENV],
  mac: process.env[MAC_ENV],
};

afterEach(() => {
  if (saved.key === undefined) delete process.env[KEY_ENV];
  else process.env[KEY_ENV] = saved.key;
  if (saved.mac === undefined) delete process.env[MAC_ENV];
  else process.env[MAC_ENV] = saved.mac;
});

describe("hmacSha256Hex", () => {
  it("matches the server HMAC construction: utf8 key bytes, not hex-decoded", async () => {
    expect(await hmacSha256Hex(KEY, PASSWORD)).toBe(nodeMac(KEY, PASSWORD));

    const unicode = "caf\u00e9 \u2603";
    expect(await hmacSha256Hex(KEY, unicode)).toBe(nodeMac(KEY, unicode));

    const hexDecoded = createHmac("sha256", Buffer.from(KEY, "hex"))
      .update(PASSWORD, "utf8")
      .digest("hex");
    expect(await hmacSha256Hex(KEY, PASSWORD)).not.toBe(hexDecoded);
  });

  it("is the SITE_PASSWORD_HMAC value passwordMatches accepts", async () => {
    process.env[KEY_ENV] = KEY;
    process.env[MAC_ENV] = await hmacSha256Hex(KEY, PASSWORD);
    expect(await passwordMatches(PASSWORD)).toBe(true);
    expect(await passwordMatches(`${PASSWORD}-no`)).toBe(false);

    process.env[MAC_ENV] = nodeMac(KEY, PASSWORD).toUpperCase();
    expect(await passwordMatches(PASSWORD)).toBe(true);
  });

  it("refuses every password when the gate env is missing", async () => {
    delete process.env[KEY_ENV];
    delete process.env[MAC_ENV];
    expect(await passwordMatches(PASSWORD)).toBe(false);
  });
});
