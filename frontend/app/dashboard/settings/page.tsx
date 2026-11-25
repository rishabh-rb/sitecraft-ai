"use client";

/* Profile avatars come from the authenticated provider and are not known at build time. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, XCircle, Sparkles, Database, Key, Globe, Image, Rocket, UserRound, MapPin, Phone, BriefcaseBusiness, Save, Check } from "lucide-react";
import { api, type ConfigStatus, type UserProfile } from "@/lib/api";

export default function SettingsPage() {
  const [config, setConfig] = useState<ConfigStatus | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileForm, setProfileForm] = useState({ name: "", phone: "", jobTitle: "", location: "", bio: "" });
  const [profileLoading, setProfileLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");

  useEffect(() => {
    let active = true;
    api.getProfile().then((data) => {
      if (!active) return;
      setProfile(data);
      setProfileForm({
        name: data.name || "",
        phone: data.phone || "",
        jobTitle: data.jobTitle || "",
        location: data.location || "",
        bio: data.bio || ""
      });
    }).catch(() => {
      if (active) setProfileMessage("Unable to load your profile.");
    }).finally(() => {
      if (active) setProfileLoading(false);
    });
    api.getConfigStatus()
      .then((data) => {
        if (active) setConfig(data);
      })
      .catch(() => {
        if (active) {
          setConfig({
            gemini: false,
            openai: false,
            openrouter: false,
            bynara: false,
            database: false,
            auth: false,
            googleOAuth: false,
            unsplash: false,
            vercel: false,
            netlify: false,
            activeProvider: "unknown",
            activeModel: "unknown"
          });
        }
      })
      .finally(() => {
      });
    return () => {
      active = false;
    };
  }, []);

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage("");
    try {
      const updated = await api.updateProfile(profileForm);
      setProfile(updated);
      setProfileMessage("Profile updated successfully.");
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Unable to update your profile.");
    } finally {
      setSavingProfile(false);
    }
  }

  const initials = (profile?.name || profile?.email || "U").slice(0, 1).toUpperCase();

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#f4f1eb] px-5 py-8 text-ink sm:py-12">
      <div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-[#9fe3d0]/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 top-0 h-96 w-96 rounded-full bg-[#f5b6a4]/35 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.3] [background-image:linear-gradient(rgba(17,19,21,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(17,19,21,.06)_1px,transparent_1px)] [background-size:42px_42px]" />
      <div className="relative mx-auto max-w-5xl">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-2 rounded-full border border-ink/10 bg-white/70 px-4 py-2 text-sm font-semibold text-ink/70 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>

        <section className="group mb-7 overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 shadow-[0_30px_90px_-35px_rgba(17,19,21,.45)] backdrop-blur-xl [transform-style:preserve-3d]">
          <div className="relative bg-[#111315] px-6 pb-20 pt-7 text-white sm:px-9">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-accent/35 blur-2xl transition duration-700 group-hover:scale-125" />
            <div className="absolute bottom-[-7rem] left-1/3 h-56 w-56 rounded-full bg-[#5bd4ba]/20 blur-3xl" />
            <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(120deg,transparent_35%,rgba(255,255,255,.25)_36%,transparent_37%)] [background-size:10px_10px]" />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[#9fe3d0]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#5bd4ba] shadow-[0_0_14px_#5bd4ba]" /> Personal workspace
                </div>
                <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Your profile</h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-white/65">Shape the identity behind your next great website.</p>
              </div>
              <div className="hidden [perspective:700px] sm:block">
                <div className="flex h-20 w-20 rotate-6 items-center justify-center rounded-3xl border border-white/20 bg-gradient-to-br from-white/25 to-white/5 shadow-[15px_20px_40px_rgba(0,0,0,.35)] transition duration-500 group-hover:rotate-12 group-hover:scale-105 [transform:rotateX(12deg)_rotateY(-18deg)]">
                  <UserRound className="h-9 w-9 text-[#9fe3d0]" />
                </div>
              </div>
            </div>
          </div>
          <div className="relative -mt-12 px-6 pb-8 sm:px-9">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[1.4rem] border-4 border-white bg-gradient-to-br from-accent to-[#a93b65] text-3xl font-black text-white shadow-[0_15px_30px_-8px_rgba(228,95,69,.7)] [transform:rotate(-4deg)] transition duration-300 hover:rotate-0 hover:scale-105">
                {profile?.image ? <img src={profile.image} alt="" className="h-full w-full rounded-xl object-cover" /> : initials}
              </div>
              <div className="pb-1">
                <p className={`text-xl font-black ${profile?.name ? "text-ink" : "text-ink/40"}`}>{profile?.name || "Your name"}</p>
                <p className="text-sm text-ink/55">{profile?.email || "Loading profile..."}</p>
              </div>
              {profile?.role ? <span className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent sm:mb-2">{profile.role}</span> : null}
            </div>

            {profileLoading ? <p className="mt-7 text-sm text-ink/60">Loading your profile...</p> : (
              <form onSubmit={saveProfile} className="mt-8 grid gap-5 sm:grid-cols-2">
                <ProfileField label="Full name" value={profileForm.name} onChange={(value) => setProfileForm({ ...profileForm, name: value })} placeholder="Rishabh Barnwal" required />
                <div>
                  <label className="text-sm font-bold text-ink">Email address</label>
                  <input className="mt-2 h-11 w-full rounded-xl border border-line bg-[#f7f5f0] px-3 text-sm text-ink/55 outline-none" value={profile?.email || ""} readOnly aria-label="Email address, read only" />
                  <p className="mt-1 text-xs text-ink/45">Email is managed by your sign-in provider and cannot be changed here.</p>
                </div>
                <ProfileField label="Phone number" icon={Phone} value={profileForm.phone} onChange={(value) => setProfileForm({ ...profileForm, phone: value })} placeholder="+91 98765 43210" />
                <ProfileField label="Job title" icon={BriefcaseBusiness} value={profileForm.jobTitle} onChange={(value) => setProfileForm({ ...profileForm, jobTitle: value })} placeholder="Founder, designer, developer..." />
                <ProfileField label="Location" icon={MapPin} value={profileForm.location} onChange={(value) => setProfileForm({ ...profileForm, location: value })} placeholder="Bengaluru, India" />
                <div className="sm:col-span-2">
                  <label className="text-sm font-bold text-ink">About you</label>
                  <textarea className="mt-2 min-h-24 w-full resize-y rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10" maxLength={500} value={profileForm.bio} onChange={(event) => setProfileForm({ ...profileForm, bio: event.target.value })} placeholder="Tell us about yourself, your work, or your next big idea..." />
                  <p className="mt-1 text-right text-xs text-ink/50">{profileForm.bio.length}/500</p>
                </div>
                <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
                  <button type="submit" disabled={savingProfile || !profileForm.name.trim()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-bold text-white shadow-[0_10px_20px_-8px_rgba(228,95,69,.9)] transition hover:-translate-y-0.5 hover:bg-[#cf4f38] disabled:pointer-events-none disabled:opacity-50">
                    {profileMessage === "Profile updated successfully." ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                    {savingProfile ? "Saving..." : "Save profile"}
                  </button>
                  {profileMessage ? <p className={`text-sm font-semibold ${profileMessage.includes("successfully") ? "text-emerald-700" : "text-red-600"}`}>{profileMessage}</p> : null}
                </div>
              </form>
            )}
          </div>
        </section>

        <div className="rounded-[2rem] border border-white/80 bg-white/75 p-6 shadow-[0_30px_90px_-35px_rgba(17,19,21,.35)] backdrop-blur-xl sm:p-9">
          <div className="flex items-center justify-between border-b border-line pb-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[#dff7ef] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[#187c68]">
                <Sparkles className="h-3 w-3" /> System configuration
              </div>
              <h2 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">API & Environment Status</h2>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 sm:flex">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>Active Provider: <strong className="uppercase text-accent">{config?.activeProvider || "Detecting..."}</strong></span>
            </div>
          </div>

          {/* Integration Status Grid */}
          <div className="mt-7 grid gap-4 sm:grid-cols-2">
            <StatusCard
              icon={Sparkles}
              title="OpenRouter AI Gateway"
              configured={config?.openrouter ?? false}
              envVar="OPENROUTER_API_KEY"
              model={config?.activeProvider === "openrouter" ? config.activeModel : "openrouter/free"}
              description="Routes structured generation through the configured OpenRouter model with provider fallback support."
            />
            <StatusCard
              icon={Sparkles}
              title="Bynara NaraRouter (Optional AI)"
              configured={config?.bynara ?? false}
              envVar="BYNARA_API_KEY"
              model={config?.activeModel || "laguna-s-2.1"}
              description="High-speed NaraRouter router API endpoint by bynara.id for multi-agent synthesis."
            />
            <StatusCard
              icon={Sparkles}
              title="Google Gemini API"
              configured={config?.gemini ?? false}
              envVar="GEMINI_API_KEY"
              model="gemini-3.6-flash"
              description="Powers autonomous multi-agent website generation with status 200 reliability."
            />
            <StatusCard
              icon={Key}
              title="OpenAI API (Optional AI)"
              configured={config?.openai ?? false}
              envVar="OPENAI_API_KEY"
              description="Optional compatible provider used when explicitly selected or reached through fallback routing."
            />
            <StatusCard
              icon={Database}
              title="PostgreSQL Database (Prisma ORM)"
              configured={config?.database ?? false}
              envVar="DATABASE_URL"
              description="Persistent storage for users, projects, websites, generations, and chat messages."
            />
            <StatusCard
              icon={Key}
              title="Auth.js / NextAuth"
              configured={config?.auth ?? false}
              envVar="AUTH_SECRET"
              description="Protects dashboard, builder, session management, and project ownership."
            />
            <StatusCard
              icon={Image}
              title="Unsplash Image API"
              configured={config?.unsplash ?? false}
              envVar="UNSPLASH_ACCESS_KEY"
              description="Provides contextual high-resolution imagery for generated hero and feature cards."
            />
            <StatusCard
              icon={Rocket}
              title="Vercel Cloud Deployment"
              configured={config?.vercel ?? false}
              envVar="VERCEL_TOKEN"
              description="Enables one-click cloud deployment from the website builder."
            />
            <StatusCard
              icon={Rocket}
              title="Netlify Cloud Deployment"
              configured={config?.netlify ?? false}
              envVar="NETLIFY_AUTH_TOKEN + NETLIFY_SITE_ID"
              description="Publishes the generated static bundle through a configured Netlify site."
            />
            <StatusCard
              icon={Globe}
              title="Google OAuth"
              configured={config?.googleOAuth ?? false}
              envVar="GOOGLE_CLIENT_ID"
              description="Optional Google single sign-on provider authentication."
            />
          </div>

          {/* Environment Variables Guide */}
          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-lg font-black tracking-normal">Setup Instructions</h2>
            <p className="mt-2 text-sm leading-6 text-ink/70">
              SiteCraft AI dynamically reads credentials from your root <code className="rounded bg-black/5 px-1.5 py-0.5 font-mono text-xs">.env</code> file.
              All core MVP features function seamlessly with automated resilience fallbacks.
            </p>

            <div className="mt-4 rounded-lg bg-[#111315] p-4 text-xs font-mono text-[#f7f3eb] overflow-x-auto">
              <p className="text-[#8e95a2] mb-2"># Core Environment Variables (.env)</p>
              <p><span className="text-emerald-400">GEMINI_API_KEY</span>=your-gemini-api-key</p>
              <p><span className="text-emerald-400">AI_MODEL</span>=gemini-3.6-flash</p>
              <p><span className="text-emerald-400">DATABASE_URL</span>=postgresql://user:pass@host:5432/sitecraft</p>
              <p><span className="text-emerald-400">AUTH_SECRET</span>=your-random-32-char-secret</p>
              <p><span className="text-amber-400">UNSPLASH_ACCESS_KEY</span>=your-unsplash-access-key</p>
              <p><span className="text-amber-400">VERCEL_TOKEN</span>=your-vercel-token</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function ProfileField({ label, value, onChange, placeholder, required, icon: Icon }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; required?: boolean; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <label className="block text-sm font-bold text-ink">
      {label}
      <div className="relative mt-2">
        {Icon ? <Icon className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink/40" /> : null}
        <input className={`h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink placeholder:text-ink/35 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/10 ${Icon ? "pl-9" : ""}`} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
      </div>
    </label>
  );
}

function StatusCard({
  icon: Icon,
  title,
  configured,
  envVar,
  model,
  description
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  configured: boolean;
  envVar: string;
  model?: string;
  description: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white/90 to-[#f3f0e9]/90 p-5 shadow-[0_12px_30px_-20px_rgba(17,19,21,.7)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_35px_-20px_rgba(17,19,21,.55)]">
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#9fe3d0]/25 blur-2xl transition duration-500 group-hover:scale-150" />
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white bg-[#111315] shadow-[4px_6px_0_#9fe3d0] transition duration-300 group-hover:-translate-y-0.5 group-hover:shadow-[6px_8px_0_#f5b6a4]">
            <Icon className="h-4 w-4 text-[#9fe3d0]" />
          </div>
          <div>
            <p className="text-sm font-black leading-5 text-ink">{title}</p>
            <p className="text-xs font-mono text-ink/60">{envVar}</p>
          </div>
        </div>
        {configured ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" /> Ready
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
            <XCircle className="h-3.5 w-3.5" /> Optional
          </span>
        )}
      </div>
      {model && <p className="mt-3 inline-flex rounded-full bg-[#dff7ef] px-2.5 py-1 text-[11px] font-bold text-[#187c68]">Model: {model}</p>}
      <p className="mt-2 text-xs leading-5 text-ink/65">{description}</p>
    </div>
  );
}
