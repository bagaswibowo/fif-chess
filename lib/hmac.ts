/** HMAC-SHA256, lowercase hex. The key is the raw UTF-8 bytes of `key`, not a hex decoding of it. */
export async function hmacSha256Hex(key: string, message: string): Promise<string> {
  const encoded = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoded.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoded.encode(message));
  const bytes = new Uint8Array(signature);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
