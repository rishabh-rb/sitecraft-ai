"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { ArrowLeft, Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

type TurnstileWidget = {
  render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void; "error-callback": () => void }) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileWidget;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"password" | "otp">("password");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileState, setTurnstileState] = useState<"loading" | "ready" | "error" | "missing">(
    turnstileSiteKey ? "loading" : "missing"
  );
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string>();
  const turnstileTokenRef = useRef("");

  function resetTurnstile() {
    turnstileTokenRef.current = "";
    setTurnstileToken("");
    if (window.turnstile && widgetId.current) window.turnstile.reset(widgetId.current);
  }

  useEffect(() => {
    if (!turnstileSiteKey) return;
    if (!turnstileRef.current) return;
    let disposed = false;
    const renderWidget = () => {
      if (disposed || !window.turnstile || !turnstileRef.current || widgetId.current) return;
      try {
        widgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token) => {
            turnstileTokenRef.current = token;
            setTurnstileToken(token);
            setTurnstileState("ready");
          },
          "expired-callback": () => {
            turnstileTokenRef.current = "";
            setTurnstileToken("");
            setTurnstileState("loading");
          },
          "error-callback": () => {
            turnstileTokenRef.current = "";
            setTurnstileToken("");
            setTurnstileState("error");
          }
        });
      } catch {
        setTurnstileState("error");
      }
    };
    let script: HTMLScriptElement | undefined;
    const retryTimer = window.setInterval(renderWidget, 100);
    if (window.turnstile) renderWidget();
    else {
      script = document.querySelector<HTMLScriptElement>("#cloudflare-turnstile-script") ?? document.createElement("script");
      if (!script.src) {
        script.id = "cloudflare-turnstile-script";
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener("load", renderWidget);
      script.addEventListener("error", () => setTurnstileState("error"));
    }
    const timeout = window.setTimeout(() => {
      if (!turnstileTokenRef.current) setTurnstileState("error");
    }, 12_000);
    return () => {
      disposed = true;
      window.clearInterval(retryTimer);
      window.clearTimeout(timeout);
      script?.removeEventListener("load", renderWidget);
      if (window.turnstile && widgetId.current) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = undefined;
      }
    };
  }, [turnstileSiteKey]);

  async function continueWithGoogle() {
    if (loading) return;
    setError("");
    setLoading(true);
    try {
      await signIn("google", { callbackUrl: "/dashboard" });
    } catch (caught) {
      setLoading(false);
      setError(caught instanceof Error ? caught.message : "Unable to continue with Google.");
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("credentials", {
      email,
      password,
      turnstileToken,
      redirect: false,
      callbackUrl: "/dashboard"
    });
    setLoading(false);
    if (result?.error) {
      resetTurnstile();
      setError("Login failed. Check your email and password.");
      return;
    }

    const session = await getSession();
    router.push(session?.user?.role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
  }

  async function requestEmailOtp() {
    setError("");
    if (!turnstileToken) {
      setError("Complete the security check before requesting a code.");
      return;
    }
    setLoading(true);
    try {
      const backendUrl = typeof window !== "undefined"
        ? `http://${window.location.hostname}:4000`
        : process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const response = await fetch(`${backendUrl}/api/auth/email/start`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, turnstileToken })
      });
      const result = (await response.json()) as { data?: { challengeId: string }; error?: { message?: string } };
      if (!response.ok || !result.data?.challengeId) throw new Error(result.error?.message || "Unable to send verification code.");
      router.push(`/verify-otp?challenge=${encodeURIComponent(result.data.challengeId)}&email=${encodeURIComponent(email)}`);
    } catch (caught) {
      resetTurnstile();
      setError(caught instanceof Error ? caught.message : "Unable to send verification code.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-paper text-ink md:grid-cols-[1fr_.8fr]">
      <section
        className="hidden bg-ink bg-cover bg-center md:block"
        style={{
          backgroundImage:
            "linear-gradient(0deg, rgba(17,19,21,.74), rgba(17,19,21,.32)), url(https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1600&q=80)"
        }}
      />
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm font-semibold text-ink/68">
            <ArrowLeft className="h-4 w-4" /> Home
          </Link>
          <h1 className="text-4xl font-black tracking-normal">Welcome back</h1>
          <p className="mt-3 text-sm leading-6 text-ink/68">
            Sign in to access your saved projects and generated websites.
          </p>
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <Button type="button" variant="outline" className="w-full" disabled={loading} onClick={continueWithGoogle}>
              <span className="text-base font-bold text-[#4285f4]">G</span> Continue with Google
            </Button>
            <div className="flex items-center gap-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
              <span className="h-px flex-1 bg-line" /> or continue with email <span className="h-px flex-1 bg-line" />
            </div>
            <label className="block text-sm font-semibold">
              Email
              <input
                className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-accent"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </label>
            {loginMethod === "password" ? <label className="block text-sm font-semibold">
              Password
              <span className="relative mt-2 block">
                <input
                  className="h-11 w-full rounded-md border border-line bg-white px-3 pr-10 outline-none focus:border-accent"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                />
                <button type="button" className="absolute right-3 top-3 text-ink/45" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label> : null}
            {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
            {turnstileSiteKey ? (
              <div>
                <div ref={turnstileRef} className="min-h-[65px]" aria-label="Cloudflare security check" />
                {turnstileState === "loading" ? <p className="text-xs text-ink/55">Loading security check...</p> : null}
                {turnstileState === "error" ? (
                  <button type="button" className="text-xs font-semibold text-red-700 underline" onClick={() => window.location.reload()}>
                    Security check could not load. Reload and try again.
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Sign-in security is not configured. Add <code className="font-mono text-xs">NEXT_PUBLIC_TURNSTILE_SITE_KEY</code> to the frontend environment.
              </p>
            )}
            {loginMethod === "password" ? (
              <Button type="submit" variant="accent" className="w-full" disabled={loading || !email || !password || !turnstileToken || turnstileState !== "ready"}>
                <LogIn className="h-4 w-4" /> {loading ? "Signing in..." : "Sign in with password"}
              </Button>
            ) : (
              <Button type="button" variant="accent" className="w-full" disabled={loading || !email || !turnstileToken || turnstileState !== "ready"} onClick={requestEmailOtp}>
                <LogIn className="h-4 w-4" /> {loading ? "Sending code..." : "Send email verification code"}
              </Button>
            )}
            {loginMethod === "password" ? (
              <Link href="/forgot-password" className="block text-center text-sm font-semibold text-accent hover:underline">
                Forgot your password?
              </Link>
            ) : null}
            <button type="button" className="w-full text-sm font-semibold text-accent" onClick={() => { setError(""); setLoginMethod(loginMethod === "otp" ? "password" : "otp"); }}>
              {loginMethod === "otp" ? "Use a password instead" : "Sign in with email OTP instead"}
            </button>
          </form>
          <p className="mt-6 text-sm text-ink/68">
            New here?{" "}
            <Link href="/register" className="font-bold text-accent">
              Create an account
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
