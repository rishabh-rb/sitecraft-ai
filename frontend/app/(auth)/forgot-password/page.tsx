"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string>();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  useEffect(() => {
    if (!siteKey || !turnstileRef.current) return;
    const renderWidget = () => {
      if (!window.turnstile || !turnstileRef.current || widgetId.current) return;
      widgetId.current = window.turnstile.render(turnstileRef.current, {
        sitekey: siteKey,
        callback: setToken,
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken("")
      });
    };
    let script: HTMLScriptElement | undefined;
    if (window.turnstile) renderWidget();
    else {
      script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", renderWidget);
      document.head.appendChild(script);
    }
    return () => {
      script?.removeEventListener("load", renderWidget);
      if (window.turnstile && widgetId.current) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = undefined;
      }
    };
  }, [siteKey]);

  async function requestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!token) {
      setError("Complete the security check before continuing.");
      return;
    }
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:4000`;
      const response = await fetch(`${backendUrl}/api/auth/password-reset/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, turnstileToken: token })
      });
      const result = (await response.json()) as { data?: { message?: string; challengeId?: string }; error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "Unable to start password reset.");
      const query = new URLSearchParams({ email });
      if (result.data?.challengeId) query.set("challenge", result.data.challengeId);
      router.push(`/reset-password?${query.toString()}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to start password reset.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-10 text-ink">
      <div className="w-full max-w-md">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-ink/68"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
        <div className="mt-8 flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-white"><KeyRound className="h-6 w-6" /></div>
        <h1 className="mt-5 text-4xl font-black">Reset your password</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">Enter your email and we&apos;ll send a verification code if an account is registered with it.</p>
        <form onSubmit={requestReset} className="mt-8 space-y-4">
          <label className="block text-sm font-semibold">
            Email address
            <input className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-accent" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required />
          </label>
          {siteKey ? <div ref={turnstileRef} className="min-h-[65px]" aria-label="Cloudflare security check" /> : <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Security verification is not configured.</p>}
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <Button type="submit" variant="accent" className="w-full" disabled={loading || !email || !token}>{loading ? "Sending..." : "Send reset code"}</Button>
        </form>
      </div>
    </main>
  );
}
