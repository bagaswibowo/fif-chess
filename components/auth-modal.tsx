"use client";

import { useState } from "react";
import type { SessionUser } from "@/lib/use-session";
import { AuthPanel } from "@/components/auth-panel";
import {
  Dialog,
  DialogContent,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";

type Props = {
  user: SessionUser | null;
  onLogin: (username: string, password: string) => Promise<any>;
  onRegister: (username: string, password: string, fullName: string, role: string) => Promise<any>;
  onLogout: () => Promise<void>;
  open: boolean;
  onClose: () => void;
  defaultMode?: "login" | "register";
};

export function AuthModal({
  user,
  onLogin,
  onRegister,
  onLogout,
  open,
  onClose,
  defaultMode = "login",
}: Props) {
  const [mode, setMode] = useState<"login" | "register">(defaultMode);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent
          className="max-w-[520px] sm:max-w-[580px] max-h-[90vh] overflow-y-auto"
          showCloseButton={false}
        >
          <AuthPanel
            user={user}
            onLogin={onLogin}
            onRegister={onRegister}
            onLogout={onLogout}
            onClose={onClose}
            defaultMode={defaultMode}
          />
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}