"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { hmacSha256Hex } from "@/lib/hmac";

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => {
        void navigator.clipboard.writeText(value).then(
          () => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1200);
          },
          () => {
            setCopied(false);
          },
        );
      }}
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

export function GateSetup() {
  const [hmacKey, setHmacKey] = useState(randomKey);
  const [password, setPassword] = useState("");
  const [passwordHmac, setPasswordHmac] = useState<string | null>(null);

  useEffect(() => {
    if (password.length === 0) {
      setPasswordHmac(null);
      return;
    }
    let cancelled = false;
    void hmacSha256Hex(hmacKey, password).then((value) => {
      if (!cancelled) setPasswordHmac(value);
    });
    return () => {
      cancelled = true;
    };
  }, [hmacKey, password]);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        These values are computed in this browser. The password below is never sent to the server.
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-2">
          <label htmlFor="site-hmac-key" className="font-mono text-xs">
            SITE_HMAC_KEY
          </label>
          <Button type="button" size="sm" variant="outline" onClick={() => setHmacKey(randomKey())}>
            New key
          </Button>
        </div>
        <div className="flex gap-2">
          <input
            id="site-hmac-key"
            readOnly
            value={hmacKey}
            onFocus={(event) => event.currentTarget.select()}
            className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-xs"
          />
          <CopyButton value={hmacKey} />
        </div>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Password</span>
        <input
          type="password"
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Type a password"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
        />
      </label>
      <div className="space-y-1">
        <label htmlFor="site-password-hmac" className="font-mono text-xs">
          SITE_PASSWORD_HMAC
        </label>
        {passwordHmac ? (
          <div className="flex gap-2">
            <input
              id="site-password-hmac"
              readOnly
              value={passwordHmac}
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 font-mono text-xs"
            />
            <CopyButton value={passwordHmac} />
          </div>
        ) : (
          <p id="site-password-hmac" className="text-xs text-muted-foreground">
            Type a password to compute it.
          </p>
        )}
      </div>
    </div>
  );
}
