"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowLeft, Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await api.register({ name, email, password });
      router.replace("/login?registered=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-5 py-10 text-ink">
      <div className="w-full max-w-md">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-ink/68"><ArrowLeft className="h-4 w-4" /> Home</Link>
        <h1 className="mt-8 text-4xl font-black tracking-normal">Create your workspace</h1>
        <p className="mt-3 text-sm leading-6 text-ink/68">
          Create an account to save your projects and generated websites to your workspace.
        </p>
        <Button type="button" variant="outline" className="mt-8 w-full" disabled={loading} onClick={continueWithGoogle}>
          <span className="text-base font-bold text-[#4285f4]">G</span> Sign up with Google
        </Button>
        <div className="flex items-center gap-3 py-5 text-[11px] font-bold uppercase tracking-[0.16em] text-ink/40">
          <span className="h-px flex-1 bg-line" /> or use your email <span className="h-px flex-1 bg-line" />
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-semibold">
            Name
            <input className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-accent" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" placeholder="Rishabh Barnwal" required />
          </label>
          <label className="block text-sm font-semibold">
            Email
            <input className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-accent" value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" placeholder="you@example.com" required />
          </label>
          <label className="block text-sm font-semibold">
            Password
            <span className="relative mt-2 block">
              <input className="h-11 w-full rounded-md border border-line bg-white px-3 pr-10 outline-none focus:border-accent" value={password} onChange={(event) => setPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required />
              <button type="button" className="absolute right-3 top-3 text-ink/45" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? "Hide password" : "Show password"}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>
          <label className="block text-sm font-semibold">
            Confirm password
            <input className="mt-2 h-11 w-full rounded-md border border-line bg-white px-3 outline-none focus:border-accent" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={8} required />
          </label>
          {error ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          <Button type="submit" variant="accent" className="w-full" disabled={loading}>
            <UserPlus className="h-4 w-4" /> {loading ? "Registering..." : "Register"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-ink/68">Already have an account? <Link href="/login" className="font-bold text-accent">Sign in</Link></p>
      </div>
    </main>
  );
}
