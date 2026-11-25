"use client";

import { SessionProvider } from "next-auth/react";
import { ToastViewport } from "@/components/studio/ToastViewport";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}<ToastViewport /></SessionProvider>;
}
