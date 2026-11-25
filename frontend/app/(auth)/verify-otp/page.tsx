"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function VerifyOtpPage() {
  return (
    <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-paper px-5 text-ink"><p className="text-sm text-ink/60">Loading verification...</p></main>}>
      <VerifyOtpForm />
    </Suspense>
  );
}

function VerifyOtpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const challenge = params.get("challenge") || "";
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(30);
  const email = params.get("email") || "";

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn("otp", { challengeId: challenge, otp, redirect: false });
    setLoading(false);
    if (result?.error) {
      setError("That code is invalid or expired.");
      return;
    }
    const session = await getSession();
    router.replace(session?.user?.role === "ADMIN" ? "/admin/dashboard" : "/dashboard");
  }

  async function resendCode() {
    if (resending || resendCooldown > 0 || !challenge) return;
    setError("");
    setResending(true);
    try {
      const backendUrl = typeof window !== "undefined"
        ? `http://${window.location.hostname}:4000`
        : process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
      const response = await fetch(`${backendUrl}/api/auth/email/resend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId: challenge })
      });
      const result = (await response.json()) as { data?: { challengeId: string }; error?: { message?: string } };
      if (!response.ok || !result.data?.challengeId) {
        throw new Error(result.error?.message || "Unable to resend verification code.");
      }
      const query = new URLSearchParams({ challenge: result.data.challengeId });
      if (email) query.set("email", email);
      router.replace(`/verify-otp?${query.toString()}`);
      setOtp("");
      setResendCooldown(30);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to resend verification code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 text-ink">
      <form onSubmit={onSubmit} className="w-full max-w-md space-y-5">
        <h1 className="text-4xl font-black">Check your email</h1>
        <p className="text-sm leading-6 text-ink/68">
          Enter the 6-digit code sent to your email address. The code expires in 5 minutes. If you don&apos;t see it, check your spam or junk folder.
        </p>
        <p className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink/68">
          Code sent to <strong className="text-ink">{email || "your email address"}</strong>
        </p>
        <input className="h-12 w-full rounded-md border border-line bg-white px-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-accent" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="\d{6}" maxLength={6} required />
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <Button type="submit" variant="accent" className="w-full" disabled={loading || !challenge || otp.length !== 6}>{loading ? "Verifying..." : "Verify code"}</Button>
        <div className="text-center text-sm text-ink/68">
          <span>Didn&apos;t receive the code? </span>
          <button type="button" className="font-semibold text-accent disabled:cursor-not-allowed disabled:opacity-50" onClick={() => void resendCode()} disabled={resending || resendCooldown > 0 || !challenge}>
            {resending ? "Sending..." : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
          </button>
        </div>
        <p className="text-center text-sm">
          <a href="/login" className="font-semibold text-accent">Use a different email address</a>
        </p>
      </form>
    </main>
  );
}
