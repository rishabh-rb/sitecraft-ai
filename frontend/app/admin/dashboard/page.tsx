"use client";

import { useCallback, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { Activity, ArrowUpRight, BarChart3, LogOut, RefreshCw, Search, Sparkles, Users } from "lucide-react";
import { api } from "@/lib/api";
import { DatabaseExplorer } from "./database-explorer";
import { useAdminRefresh } from "./use-admin-refresh";

function MiniBars({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex h-24 items-end gap-1.5" aria-hidden>
      {values.slice(-14).map((value, index) => (
        <div key={index} className="min-w-0 flex-1 rounded-t-sm"
          style={{ height: `${(value / max) * 100}%`, background: color }} />
      ))}
    </div>
  );
}

function StatCard({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof Users }) {
  return (
    <article className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-ink/60">{label}</p>
        <span className="rounded-lg bg-accent/10 p-2 text-accent"><Icon className="h-4 w-4" aria-hidden /></span>
      </div>
      <p className="mt-4 text-3xl font-black tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-ink/60">{detail}</p>
    </article>
  );
}

function Overview({ accessToken, refreshVersion }: { accessToken: string; refreshVersion: number }) {
  const load = useCallback((signal: AbortSignal) => api.adminDatabaseStats(accessToken, signal), [accessToken]);
  const { snapshot, error } = useAdminRefresh(load, 60_000, refreshVersion);
  const stats = snapshot?.result;

  return (
    <section className="space-y-4" aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="text-lg font-black">Operations overview</h2>
      {error ? (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {snapshot ? "Showing the last successful overview. " : ""}{error}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={stats?.totalUsers ?? "—"} detail={stats ? `${stats.newUsers} joined in the last 30 days` : "All registered users"} icon={Users} />
        <StatCard label="Active users" value={stats?.activeUsers ?? "—"} detail="Accounts updated in the last 30 days" icon={Activity} />
        <StatCard label="Generations" value={stats?.totalGenerations ?? "—"} detail={stats ? `${stats.successfulGenerations} succeeded in the last 30 days` : "Last 30 days"} icon={Sparkles} />
        <StatCard label="Websites created" value={stats?.totalWebsites ?? "—"} detail={stats ? `${stats.totalProjects} projects created in the last 30 days` : "Last 30 days"} icon={BarChart3} />
      </div>
      {stats ? (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <article className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <div><h3 className="font-black">Sign-ups & activity</h3><p className="mt-1 text-xs text-ink/60">Last 30 days</p></div>
              <ArrowUpRight className="h-5 w-5 text-teal" aria-hidden />
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div>
                <div className="mb-2 flex justify-between text-xs font-semibold">
                  <span className="text-ink/60">New sign-ups</span><strong>{stats.newUsers}</strong>
                </div>
                <MiniBars values={stats.userGrowth.map((item) => item.count)} color="#e45f45" />
              </div>
              <div>
                <div className="mb-2 flex justify-between text-xs font-semibold">
                  <span className="text-ink/60">Prompts recorded</span><strong>{stats.activityTimeline.reduce((count, item) => count + item.count, 0)}</strong>
                </div>
                <MiniBars values={stats.activityTimeline.map((item) => item.count)} color="#0f766e" />
              </div>
            </div>
          </article>
          <article className="rounded-2xl border border-line bg-ink p-5 text-white shadow-soft">
            <div className="flex items-center justify-between">
              <h3 className="font-black">Popular searches</h3><Search className="h-5 w-5 text-orange-300" aria-hidden />
            </div>
            <ul className="mt-5 space-y-3">
              {stats.popularSearches.slice(0, 6).map((item) => (
                <li key={item.query} className="flex justify-between gap-4 text-sm">
                  <span className="truncate" title={item.query}>{item.query}</span><strong>{item.count}</strong>
                </li>
              ))}
            </ul>
            {!stats.popularSearches.length ? <p className="mt-4 text-sm text-white/65">No search activity in the last 30 days.</p> : null}
          </article>
        </div>
      ) : null}
    </section>
  );
}

export default function AdminDashboardPage() {
  const { data: session, status } = useSession({ required: true });
  const [refreshVersion, setRefreshVersion] = useState(0);
  const accessToken = session?.user?.role === "ADMIN" ? session.user.accessToken : undefined;

  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-black sm:text-lg">
            <Sparkles className="h-5 w-5 shrink-0 text-accent" aria-hidden /> SiteCraft AI
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden text-xs text-ink/60 md:inline">{session?.user?.email}</span>
            {accessToken ? (
              <button type="button" onClick={() => setRefreshVersion((version) => version + 1)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-xs font-bold hover:bg-paper">
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
              </button>
            ) : null}
            {session ? (
              <button type="button" onClick={() => void signOut({ callbackUrl: "/login" })}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink/70 hover:bg-red-50 hover:text-red-700"
                aria-label="Sign out" title="Sign out">
                <LogOut className="h-4 w-4" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] space-y-7 px-4 py-7 sm:px-6 sm:py-9">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Admin console</h1>
        {status === "loading" ? <p role="status" className="text-sm text-ink/60">Loading admin workspace…</p> : null}
        {status === "authenticated" && !accessToken ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {session?.user?.role === "ADMIN" ? "Your admin session needs to be renewed. Sign out and sign in again." : "Admin access required."}
          </p>
        ) : null}
        {accessToken ? (
          <div key={accessToken} className="space-y-7">
            <DatabaseExplorer accessToken={accessToken} refreshVersion={refreshVersion} />
            <Overview accessToken={accessToken} refreshVersion={refreshVersion} />
          </div>
        ) : null}
      </div>
    </main>
  );
}
