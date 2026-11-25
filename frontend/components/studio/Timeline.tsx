"use client";
import { useEffect, useState } from "react";
import {
  Brain,
  Check,
  Code2,
  Image,
  LayoutTemplate,
  Loader2,
  Pause,
  Play,
  ShieldCheck,
  Square,
} from "lucide-react";
import type { GenerationJob } from "@/lib/api";
const stages = [
  {
    name: "Plan",
    key: /plan|understand/i,
    icon: Brain,
    text: "Translate the brief into a page structure",
  },
  {
    name: "Design",
    key: /design|theme/i,
    icon: LayoutTemplate,
    text: "Choose a palette, typography and layout",
  },
  {
    name: "Images",
    key: /image|asset/i,
    icon: Image,
    text: "Prepare a visual direction",
  },
  {
    name: "Code",
    key: /code|build|generat/i,
    icon: Code2,
    text: "Build the responsive website",
  },
  {
    name: "Quality",
    key: /qa|quality|check|complete/i,
    icon: ShieldCheck,
    text: "Review source and requirement coverage",
  },
];
export function Timeline({
  job,
  working,
  demo,
  paused,
  onPause,
  onCancel,
  sections,
}: {
  job?: GenerationJob | null;
  working: boolean;
  demo: boolean;
  paused: boolean;
  onPause: () => void;
  onCancel?: () => void;
  sections: number;
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!working || demo) return;
    const start = Date.now();
    const timer = setInterval(
      () => setElapsed(Math.floor((Date.now() - start) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [working, demo, job?.id]);
  const index = job
    ? Math.max(
        0,
        stages.findIndex((s) => s.key.test(job.stage)),
      )
    : 0;
  const completed = job?.status === "completed";
  const revision = job?.id.startsWith("revision-");
  return (
    <section className="sc-timeline">
      <div className="sc-row-between">
        <div className="sc-panel-heading">
          <span className={working && !paused ? "sc-dot sc-pulse" : "sc-dot"} />
          <h3>
            {working
              ? paused
                ? "Updates paused"
                : "Your idea, taking shape"
              : completed
                ? "Your preview is ready"
                : "The creative process"}
          </h3>
        </div>
        {working && (
          <div className="sc-inline-actions">
            <button
              className="sc-icon"
              onClick={onPause}
              aria-label={
                paused
                  ? "Resume updates"
                  : demo
                    ? "Pause demo"
                    : "Pause displayed updates"
              }
            >
              {paused ? <Play size={15} /> : <Pause size={15} />}
            </button>
            {onCancel && (
              <button
                className="sc-icon"
                aria-label="Cancel generation"
                onClick={onCancel}
              >
                <Square size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="sc-timeline-stages">
        {stages.map((stage, i) => {
          const done = !revision && (completed || (!!job && i < index));
          const active = working && i === index;
          return (
            <div
              key={stage.name}
              className={`${done ? "is-done" : ""} ${active ? "is-running" : ""}`}
              title={stage.text}
            >
              <span>
                {done ? (
                  <Check size={16} />
                ) : active && !paused ? (
                  <Loader2 size={17} className="sc-spin" />
                ) : (
                  <stage.icon size={17} />
                )}
              </span>
              <b>{stage.name}</b>
            </div>
          );
        })}
      </div>
      {job && (
        <>
          <div
            className={`sc-progress ${working && !job.progress ? "sc-indeterminate" : ""}`}
          >
            <i
              style={{
                width: working && !job.progress ? "30%" : `${job.progress}%`,
              }}
            />
          </div>
          <p className="sc-small sc-muted" role="status">
            {job.message}{" "}
            {working && !demo && "Timing depends on your provider."}
          </p>
        </>
      )}
      {!working && (
        <p className="sc-small sc-muted">
          {sections} sections in this draft ·{" "}
          {demo ? "Local template preview" : "Existing AI pipeline"}
        </p>
      )}
      {working && (
        <p className="sc-small sc-muted">
          {demo
            ? "Demonstration · about 4 seconds"
            : paused
              ? "Only displayed updates are paused. Generation continues on the server."
              : "Status comes from the generation service; no hidden reasoning is displayed."}
        </p>
      )}
      {working &&
        !demo &&
        !paused &&
        !!job &&
        job.progress > 5 &&
        elapsed > 3 && (
          <p className="sc-small sc-muted">
            Estimated remaining: about{" "}
            {Math.max(
              5,
              Math.round((elapsed * (100 - job.progress)) / job.progress / 5) *
                5,
            )}{" "}
            seconds. Based on current progress; provider timing varies.
          </p>
        )}
    </section>
  );
}
