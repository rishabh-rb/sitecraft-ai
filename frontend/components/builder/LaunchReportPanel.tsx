"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleMinus, Gauge, ListChecks, Route, XCircle } from "lucide-react";
import type { LaunchCheck, LaunchReport, LaunchRequirement } from "@sitecraft/ml";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

const checkStatus = {
  pass: { label: "Passed", icon: CheckCircle2, style: "text-teal" },
  review: { label: "Review", icon: AlertTriangle, style: "text-amber-800" },
  fail: { label: "Needs attention", icon: XCircle, style: "text-red-700" },
  "not-applicable": { label: "N/A", icon: CircleMinus, style: "text-ink/55" }
};

const requirementLabels: Record<LaunchRequirement["status"], string> = {
  covered: "Covered", partial: "Partial", missing: "Missing", omitted: "Omitted as requested", unexpected: "Unexpected"
};

function CheckList({ checks }: { checks: LaunchCheck[] }) {
  return (
    <ul className="divide-y divide-line">
      {checks.map((item) => {
        const { label, icon: Icon, style } = checkStatus[item.status];
        return (
          <li key={item.label} className="flex items-start gap-3 py-3">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${style}`} aria-hidden />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-bold">{item.label}</p>
                <span className={`text-xs font-bold ${style}`}>{label}</span>
              </div>
              <p className="mt-1 break-words text-xs leading-5 text-ink/70">{item.detail}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function PublishChecklist({ report, storageKey }: { report: LaunchReport; storageKey: string }) {
  const manualSteps = [
    "Inspect the mobile preview and keyboard navigation.",
    "Verify links and any form delivery on the deployed site.",
    "Verify draft copy, images, and business details.",
    "Set production environment variables if your site requires them."
  ];
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      return Array.isArray(saved) ? saved.filter((step): step is string => typeof step === "string") : [];
    } catch {
      return [];
    }
  });

  function toggle(step: string) {
    const next = completed.includes(step) ? completed.filter((item) => item !== step) : [...completed, step];
    setCompleted(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage is optional. */ }
  }

  return (
    <section aria-labelledby="publish-checklist" className="rounded-xl border border-line bg-white p-5 shadow-soft">
      <h3 id="publish-checklist" className="mb-1 flex items-center gap-2 font-black"><ListChecks className="h-5 w-5 text-teal" aria-hidden /> Ready to Publish checklist</h3>
      <CheckList checks={report.checklist} />
      <fieldset className="mt-2 space-y-2 rounded-lg border border-line bg-paper p-3">
        <legend className="px-1 text-xs font-bold">Before publishing</legend>
        {manualSteps.map((step) => (
          <label key={step} className="flex items-start gap-2 text-sm leading-5 text-ink/75">
            <input type="checkbox" className="mt-1 accent-[#0f766e]" checked={completed.includes(step)} onChange={() => toggle(step)} />
            {step}
          </label>
        ))}
      </fieldset>
    </section>
  );
}

export function LaunchReportPanel({ projectId, artifactId, version, onPreview }: {
  projectId: string;
  artifactId: string;
  version: number;
  onPreview: () => void;
}) {
  const [report, setReport] = useState<LaunchReport>();
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void api.getLaunchReport(projectId, controller.signal).then((value) => {
      if (!controller.signal.aborted) {
        setReport(value);
        setError("");
      }
    }).catch((caught: unknown) => {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Unable to load launch checks.");
    });
    return () => controller.abort();
  }, [projectId, artifactId, version, reload]);

  return (
    <div className="panel-scroll min-h-0 flex-1 overflow-y-auto bg-paper p-3 sm:p-5">
      <div className="mx-auto max-w-4xl space-y-4">
        <section aria-labelledby="launch-score" className="rounded-xl border border-line bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="launch-score" className="flex items-center gap-2 text-lg font-black"><Gauge className="h-5 w-5 text-accent" aria-hidden /> SiteCraft Launch Score</h2>
            <Button type="button" variant="outline" className="h-8 text-xs" onClick={onPreview}>Open preview</Button>
          </div>
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">AI-generated draft content — verify before publishing.</p>
          {error ? (
            <div className="mt-4 flex flex-wrap items-center gap-2" role="alert">
              <p className="text-sm text-red-700">{error}</p>
              <Button type="button" variant="outline" className="h-8 text-xs" onClick={() => { setError(""); setReload(reload + 1); }}>Retry</Button>
            </div>
          ) : null}
          {!report && !error ? <p className="mt-4 text-sm text-ink/65" role="status">Checking the generated website…</p> : null}
          {report ? (
            <>
              <div className="my-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-line bg-paper p-3">
                  <p className="text-xs font-bold text-ink/70">Launch Score</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{report.score}<span className="text-sm text-ink/60"> / 100</span></p>
                </div>
                <div className="rounded-lg border border-line bg-paper p-3">
                  <p className="text-xs font-bold text-ink/70">Requirement coverage</p>
                  <p className="mt-1 text-2xl font-black tabular-nums">{report.coverage.total ? report.coverage.covered + " / " + report.coverage.total : "—"}</p>
                </div>
              </div>
              <p className="text-xs leading-5 text-ink/65">The score uses passed automated checks and matched requirements. Browser behavior, accessibility compliance, and hosted services require manual review.</p>
              <CheckList checks={report.checks} />
              {report.claims.length || report.missingContent.length ? (
                <ul className="list-disc space-y-1 rounded-lg bg-amber-50 py-3 pl-8 pr-3 text-xs leading-5 text-amber-900">
                  {[...report.claims, ...report.missingContent].map((item) => <li key={item}>{item}</li>)}
                </ul>
              ) : null}
            </>
          ) : null}
        </section>
        {report ? (
          <>
            <section aria-labelledby="requirement-trace" className="rounded-xl border border-line bg-white p-5 shadow-soft">
              <h3 id="requirement-trace" className="flex items-center gap-2 font-black"><Route className="h-5 w-5 text-teal" aria-hidden /> Requirement-to-Website Traceability</h3>
              <p className="mt-2 text-xs leading-5 text-ink/65">Matches common requirements from your brief against evidence in this version’s preview.</p>
              {report.requirements.length ? (
                <div className="mt-3 overflow-x-auto" role="region" tabIndex={0} aria-label="Requirement coverage table">
                  <table className="w-full min-w-[420px] text-left text-xs">
                    <thead className="border-b border-line bg-paper">
                      <tr><th scope="col" className="p-2.5">Prompt requirement</th><th scope="col" className="p-2.5">Status</th><th scope="col" className="p-2.5">Generated result</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {report.requirements.map((item) => (
                        <tr key={item.label} className="align-top">
                          <th scope="row" className="p-2.5 font-semibold">{item.label}<span className="mt-1 block font-normal text-ink/60">“{item.excerpt}”</span></th>
                          <td className="p-2.5 font-semibold">{requirementLabels[item.status]}</td>
                          <td className="p-2.5 text-ink/75">{item.evidence}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p className="mt-3 text-sm text-ink/65">No supported requirement patterns were found in this brief.</p>}
            </section>
            <PublishChecklist report={report} storageKey={`sitecraft-launch:${projectId}:${artifactId}:${version}`} />
          </>
        ) : null}
      </div>
    </div>
  );
}
