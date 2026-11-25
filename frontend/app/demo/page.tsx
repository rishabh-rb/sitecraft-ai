import Link from "next/link";
import { ArrowLeft, ExternalLink, Sparkles } from "lucide-react";
import { demoHtml } from "@/lib/demo-html";

export default function DemoPage() {
  return (
    <main className="min-h-screen bg-[#ede7dc] text-ink">
      <header className="flex items-center justify-between border-b border-line bg-white px-5 py-3.5">
        <div className="flex items-center gap-3">
          <Link href="/" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line hover:bg-black/5" aria-label="Back to home">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <p className="flex items-center gap-2 text-sm font-black"><Sparkles className="h-4 w-4 text-accent" /> SiteCraft AI Demo</p>
            <p className="text-xs text-ink/55">A public preview — no account required</p>
          </div>
        </div>
        <Link href="/register" className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-xs font-bold text-white hover:bg-[#cf4f38]">
          Build your own <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="rounded-full bg-teal/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-teal">Generated website preview</span>
            <h1 className="mt-3 text-2xl font-black tracking-tight sm:text-3xl">Restaurant website from one prompt</h1>
          </div>
          <div className="rounded-lg border border-line bg-white px-3 py-2 text-xs text-ink/65 shadow-sm">Prompt: “Create a modern restaurant with menu, story, and reservations.”</div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-line bg-white p-2 shadow-soft sm:p-3">
          <iframe title="Public SiteCraft generated website demo" sandbox="allow-scripts allow-forms allow-popups" className="h-[720px] w-full rounded-xl border border-black/10 bg-[#17120f] sm:h-[820px]" srcDoc={demoHtml} />
        </div>
        <div className="mt-5 grid gap-3 text-xs text-ink/65 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-white p-4"><strong className="text-ink">Prompt-to-plan</strong><p className="mt-1">The brief becomes pages, sections, content, and visual direction.</p></div>
          <div className="rounded-lg border border-line bg-white p-4"><strong className="text-ink">Responsive preview</strong><p className="mt-1">Generated layouts are designed for desktop, tablet, and mobile.</p></div>
          <div className="rounded-lg border border-line bg-white p-4"><strong className="text-ink">Export-ready</strong><p className="mt-1">Review generated files, revise with chat, and download the project.</p></div>
        </div>
      </section>
    </main>
  );
}
