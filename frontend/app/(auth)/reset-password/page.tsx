"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ResetPasswordPage() {
  return <Suspense fallback={<main className="flex min-h-screen items-center justify-center bg-paper">Loading...</main>}><ResetPasswordForm /></Suspense>;
}

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const challengeId = params.get("challenge") || "";
  const email = params.get("email") || "";
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function completeReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || `http://${window.location.hostname}:4000`;
      const response = await fetch(`${backendUrl}/api/auth/password-reset/complete`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ challengeId, otp, password })
      });
      const result = (await response.json()) as { error?: { message?: string } };
      if (!response.ok) throw new Error(result.error?.message || "Unable to reset password.");
      router.replace("/login?reset=success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reset password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-10 text-ink">
      <form onSubmit={completeReset} className="w-full max-w-md space-y-4">
        <Link href="/login" className="inline-flex items-center gap-2 text-sm font-semibold text-ink/68"><ArrowLeft className="h-4 w-4" /> Back to sign in</Link>
        <h1 className="pt-6 text-4xl font-black">Create a new password</h1>
        <p className="text-sm leading-6 text-ink/68">Enter the 6-digit code sent to {email || "your email"} and choose a new password.</p>
        {!challengeId ? <p className="rounded-md border border-line bg-white px-3 py-2 text-sm text-ink/65">If an account exists for this email, a verification code has been sent. Check your inbox or spam folder.</p> : null}
        <input className="h-12 w-full rounded-md border border-line bg-white px-3 text-center text-2xl tracking-[0.5em] outline-none focus:border-accent" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="000000" required />
        <label className="block text-sm font-semibold">New password<span className="relative mt-2 block"><input className="h-11 w-full rounded-md border border-line bg-white px-3 pr-10 outline-none focus:border-accent" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} minLength={8} required /><button type="button" className="absolute right-3 top-3 text-ink/45" onClick={() => setShowPassword((visible) => !visible)}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button></span></label>
        <label className="block text-sm font-semibold">Confirm new password<input className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-accent" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type={showPassword ? "text" : "password"} minLength={8} required /></label>
        {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        <Button type="submit" variant="accent" className="w-full" disabled={loading || !challengeId || otp.length !== 6}>{loading ? "Updating..." : "Update password"}</Button>
      </form>
    </main>
  );
}
