"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCheck,
  Code2,
  Globe2,
  Layers3,
  Loader2,
  MousePointer2,
  Play,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { StudioNav } from "@/components/studio/StudioNav";
import { TemplateCard } from "@/components/studio/TemplateCard";
import { LiveVisitors } from "@/components/LiveVisitors";
import { inferTemplate, templates, templateWebsite } from "@/lib/templates";
export default function Home() {
  const [selected, setSelected] = useState("restaurant"),
    [prompt, setPrompt] = useState(
      "A warm, inviting website for my neighborhood restaurant",
    ),
    [stage, setStage] = useState(-1);
  const template = templates.find((t) => t.id === selected) || templates[0];
  const html = useMemo(() => templateWebsite(template).html, [template]);
  useEffect(() => {
    if (stage < 0) return;
    const timer = setTimeout(() => {
      if (stage >= 3) {
        setSelected(inferTemplate(prompt).id);
        setStage(-1);
      } else setStage(stage + 1);
    }, 650);
    return () => clearTimeout(timer);
  }, [stage, prompt]);
  return (
    <div className="sc-site">
      <StudioNav />
      <main>
        <section className="sc-hero sc-container">
          <div className="sc-hero-copy">
            <div className="sc-eyebrow">
              <span className="sc-dot" /> YOUR IDEA. A WEBSITE. A NEW
              POSSIBILITY.
            </div>
            <h1>
              Big ideas.
              <br />
              Beautiful websites.
              <br />
              <em>Just a prompt away.</em>
            </h1>
            <p className="sc-hero-description">
              Meet your AI website studio. Go from a spark of inspiration to a
              responsive website you can edit, understand, and make your own.
            </p>
            <div className="sc-prompt-card">
              <label htmlFor="hero-prompt">
                What would you like to create?
              </label>
              <textarea
                id="hero-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                maxLength={2000}
              />
              <div className="sc-row-between">
                <span className="sc-small sc-muted">
                  Try an idea. See it take shape.
                </span>
                <button
                  className="sc-btn sc-btn-coral"
                  disabled={!prompt.trim() || stage >= 0}
                  onClick={() => setStage(0)}
                >
                  {stage >= 0 ? (
                    <Loader2 className="sc-spin" size={17} />
                  ) : (
                    <Sparkles size={17} />
                  )}{" "}
                  {stage >= 0 ? "Creating…" : "Preview idea"}
                </button>
              </div>
            </div>
            <div className="sc-starter-row">
              {templates.slice(0, 4).map((t) => (
                <button
                  key={t.id}
                  className={selected === t.id ? "is-active" : ""}
                  onClick={() => {
                    setSelected(t.id);
                    setPrompt(t.prompt);
                    setStage(-1);
                  }}
                >
                  {t.industry}
                </button>
              ))}
            </div>
            <p className="sc-small sc-muted sc-demo-note">
              Interactive template demo · No sign-up needed.{" "}
              <Link href="/playground">Open the full playground</Link>
            </p>
            <div className="sc-hero-proof">
              <span>
                <Check size={15} /> Your code to keep
              </span>
              <span>
                <Check size={15} /> Responsive by design
              </span>
              <span>
                <Check size={15} /> Quality you can see
              </span>
            </div>
          </div>
          <div className="sc-hero-visual">
            <div className="sc-orbit-label">
              <Sparkles size={16} /> A LITTLE IDEA, BROUGHT TO LIFE
            </div>
            <div className="sc-browser">
              <div className="sc-browser-bar">
                <span className="sc-traffic">
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  {template.name.toLowerCase().replace(/[^a-z0-9]/g, "")}
                  .sitecraft.preview
                </span>
                <Globe2 size={13} />
              </div>
              <div className="sc-hero-frame" key={selected}>
                <iframe
                  title="Interactive website demo"
                  srcDoc={html}
                  sandbox="allow-scripts allow-forms"
                />
                {stage >= 0 && (
                  <div className="sc-generating-cover" role="status">
                    <div className="sc-generating-icon">
                      <Sparkles />
                    </div>
                    <strong>
                      {
                        [
                          "Understanding your idea",
                          "Finding a visual direction",
                          "Building responsive sections",
                          "Checking the finishing touches",
                        ][stage]
                      }
                    </strong>
                    <span>This is a local template demonstration</span>
                    <div className="sc-progress">
                      <i style={{ width: `${(stage + 1) * 25}%` }} />
                    </div>
                    <button
                      className="sc-text-btn"
                      onClick={() => setStage(-1)}
                    >
                      Cancel preview
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="sc-float-card">
              <span className="sc-success-icon">
                <CheckCheck size={21} />
              </span>
              <div>
                <strong>From idea to something real.</strong>
                <span>
                  Editable. Responsive. Ready for your finishing touch.
                </span>
              </div>
            </div>
            <div className="sc-preview-caption">
              <span className="sc-dot" /> Live, interactive preview{" "}
              <Link href={`/playground?template=${selected}`}>
                <MousePointer2 size={14} /> Make it yours
              </Link>
            </div>
          </div>
        </section>
        <div className="sc-value-strip sc-container">
          <span>
            BUILT FOR YOUR NEXT
            <br />
            <b>“I have an idea.”</b>
          </span>
          <p>
            <Layers3 /> Multi-agent workflow
          </p>
          <p>
            <ShieldCheck /> Visible quality checks
          </p>
          <p>
            <Code2 /> Exportable source code
          </p>
          <p>
            <Globe2 /> Publish your website
          </p>
        </div>
        <section className="sc-section sc-container">
          <div className="sc-section-heading">
            <div>
              <div className="sc-eyebrow">A HEAD START, IN YOUR STYLE</div>
              <h2>
                A blank canvas.
                <br />
                Or a beautiful starting point.
              </h2>
            </div>
            <div>
              <p>
                Pick a direction, change the details, make it feel like you.
              </p>
              <Link href="/templates" className="sc-text-btn">
                Explore all 8 templates <Layers3 size={16} />
              </Link>
            </div>
          </div>
          <div className="sc-grid-3">
            {[templates[0], templates[2], templates[1]].map((t) => (
              <TemplateCard template={t} key={t.id} compact />
            ))}
          </div>
        </section>
        <section className="sc-quality-section">
          <div className="sc-container sc-quality-grid">
            <div>
              <div className="sc-eyebrow">MORE THAN A PRETTY PREVIEW</div>
              <h2>
                Build with confidence.
                <br />
                <em>Launch with clarity.</em>
              </h2>
              <p>
                SiteCraft makes the process visible. Understand how your brief
                becomes a website, review the details, and keep the source when
                you’re done.
              </p>
              <Link href="/playground" className="sc-btn sc-btn-dark">
                <Play size={16} /> Try the studio
              </Link>
            </div>
            <div className="sc-quality-card">
              <div className="sc-row-between">
                <strong>
                  <ShieldCheck size={19} /> SiteCraft Launch Score
                </strong>
                <span className="sc-tag">Source checks</span>
              </div>
              {[
                ["Requirement coverage", "See what your prompt produced"],
                ["Accessibility & SEO", "Review headings, labels and metadata"],
                ["Ready to Publish", "A practical pre-launch checklist"],
              ].map(([name, text]) => (
                <div className="sc-quality-row" key={name}>
                  <span className="sc-check">
                    <Check size={17} />
                  </span>
                  <div>
                    <b>{name}</b>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
              <p className="sc-small sc-muted">
                Checks explain what was inspected. Live behavior and
                accessibility compliance still need a human review.
              </p>
            </div>
          </div>
        </section>
        <section className="sc-section sc-container">
          <div className="sc-center">
            <div className="sc-eyebrow">A SIMPLE PATH TO YOUR NEXT WEBSITE</div>
            <h2>
              Start with words.
              <br />
              Finish with something worth sharing.
            </h2>
          </div>
          <div className="sc-workflow">
            {[
              [
                "01",
                "Tell us your idea",
                "Describe your audience, goals and style. Or build a brief with guided prompts.",
              ],
              [
                "02",
                "Watch it take shape",
                "Follow planning, design, code and quality checks in one workspace.",
              ],
              [
                "03",
                "Make it your own",
                "Adjust the design, refine a section, compare versions and export your work.",
              ],
            ].map(([n, title, text]) => (
              <article key={n}>
                <span>{n}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="sc-final-cta sc-container">
          <WandSparkles size={28} />
          <h2>
            Your next idea deserves
            <br />a place on the web.
          </h2>
          <Link href="/dashboard" className="sc-btn sc-btn-coral">
            <Sparkles size={17} /> Start creating
          </Link>
          <p>Keep your ideas, your style, and your code.</p>
        </section>
      </main>
      <footer className="sc-footer sc-container">
        <Link href="/" className="sc-logo">
          <Sparkles size={20} /> SiteCraft AI
        </Link>
        <span>Thoughtfully generated. Yours to create.</span>
        <LiveVisitors />
        <Link href="/templates">Templates</Link>
        <Link href="/login">Log in</Link>
      </footer>
    </div>
  );
}
