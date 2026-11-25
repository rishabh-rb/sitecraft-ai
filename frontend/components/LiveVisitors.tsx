"use client";

import { useEffect, useState } from "react";

export function LiveVisitors() {
  const [count, setCount] = useState<number | null>();

  useEffect(() => {
    const lifetime = new AbortController();
    let pending = false;
    async function ping() {
      if (document.hidden || pending) return;
      pending = true;
      try {
        const response = await fetch("/api/visitors", {
          method: "POST",
          cache: "no-store",
          signal: AbortSignal.any([lifetime.signal, AbortSignal.timeout(8_000)])
        });
        if (!response.ok) throw new Error("Presence unavailable");
        const { activeVisitors } = await response.json() as { activeVisitors: number };
        if (!lifetime.signal.aborted) setCount(activeVisitors);
      } catch {
        if (!lifetime.signal.aborted) setCount(null);
      } finally {
        pending = false;
      }
    }
    const initial = window.setTimeout(ping, 0);
    const interval = window.setInterval(ping, 15_000);
    document.addEventListener("visibilitychange", ping);
    return () => {
      lifetime.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", ping);
    };
  }, []);

  const label = typeof count === "number"
    ? count.toLocaleString("en-IN") + (count === 1 ? " visitor online" : " visitors online")
    : count === null ? "Visitor count unavailable" : "Checking active visitors…";

  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-ink/45 px-3 py-1.5 text-xs font-semibold text-white/90"
      title="Browser sessions active on the home page in the last 45 seconds. Updates every 15 seconds.">
      <span aria-hidden className={`h-2 w-2 rounded-full ${typeof count === "number" ? "bg-emerald-400" : "bg-white/40"}`} />
      <span className="tabular-nums">{label}</span>
    </p>
  );
}
