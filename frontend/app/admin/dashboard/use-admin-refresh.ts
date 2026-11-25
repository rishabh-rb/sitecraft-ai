import { useEffect, useState } from "react";
import { ApiRequestError, type AdminDatabaseSnapshot } from "@/lib/api";

type RefreshState<Result> = {
  snapshot?: AdminDatabaseSnapshot<Result>;
  error?: string;
  refreshing: boolean;
};

export function useAdminRefresh<Result>(
  load: (signal: AbortSignal) => Promise<AdminDatabaseSnapshot<Result>>,
  intervalMs: number,
  refreshVersion: number
) {
  const [state, setState] = useState<RefreshState<Result>>({ refreshing: true });

  useEffect(() => {
    let disposed = false;
    let authFailed = false;
    let activeRequest: AbortController | undefined;

    async function refresh() {
      if (disposed || activeRequest || authFailed || document.hidden) return;
      const controller = new AbortController();
      activeRequest = controller;
      setState((current) => ({ ...current, refreshing: true }));
      const timeout = window.setTimeout(() => controller.abort(), 25_000);

      try {
        const snapshot = await load(controller.signal);
        if (!disposed) setState({ snapshot, refreshing: false });
      } catch (error) {
        if (disposed) return;
        authFailed = error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
        const message = controller.signal.aborted
          ? "The database request timed out."
          : error instanceof Error ? error.message : "Unable to fetch database records.";
        setState((current) => ({
          snapshot: authFailed ? undefined : current.snapshot,
          error: message,
          refreshing: false
        }));
      } finally {
        window.clearTimeout(timeout);
        activeRequest = undefined;
      }
    }

    const initial = window.setTimeout(refresh, 0);
    const interval = window.setInterval(refresh, intervalMs);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      disposed = true;
      activeRequest?.abort();
      window.clearTimeout(initial);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [intervalMs, load, refreshVersion]);

  return state;
}
