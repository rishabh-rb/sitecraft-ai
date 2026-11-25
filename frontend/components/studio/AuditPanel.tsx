"use client";
import { CheckCircle2, AlertCircle, FileDown } from "lucide-react";
import type { GeneratedWebsite } from "@/lib/api";
import { auditWebsite, printReport } from "@/lib/studio";
import { toast } from "./ToastViewport";
export function AuditPanel({ website }: { website: GeneratedWebsite }) {
  const report = auditWebsite(website.html, website.plan.colorPalette);
  return (
    <div className="sc-inspector-content">
      <div className="sc-panel-heading">
        <CheckCircle2 size={18} />
        <h3>Know what’s ready</h3>
      </div>
      <p className="sc-small sc-muted">
        Static source checks. These estimates are not Lighthouse scores or WCAG
        certification.
      </p>
      <div className="sc-score-grid">
        {["Accessibility", "SEO", "Performance"].map((category) => (
          <div key={category}>
            <div
              className="sc-score-ring"
              style={
                {
                  "--score": `${report.score(category)}%`,
                } as React.CSSProperties
              }
            >
              <b>{report.score(category)}</b>
            </div>
            <span>{category}</span>
          </div>
        ))}
      </div>
      {["Accessibility", "SEO", "Performance"].map((category) => (
        <div className="sc-audit-group" key={category}>
          <h4>{category}</h4>
          {report.checks
            .filter((c) => c.category === category)
            .map((check) => (
              <details key={check.name}>
                <summary>
                  {check.passed ? (
                    <CheckCircle2 size={16} className="sc-teal" />
                  ) : (
                    <AlertCircle size={16} className="sc-coral" />
                  )}
                  <span>{check.name}</span>
                  <b>{check.passed ? "Pass" : "Review"}</b>
                </summary>
                <p>{check.detail}</p>
              </details>
            ))}
        </div>
      ))}
      <div className="sc-social-card">
        <span className="sc-small">SEARCH PREVIEW</span>
        <b>{report.title || website.plan.siteName}</b>
        <p>{report.description || "Add a meta description to your website."}</p>
      </div>
      <p className="sc-small sc-muted">Keywords: {report.keywords}</p>
      <button
        className="sc-btn sc-btn-outline sc-full"
        onClick={() => {
          try {
            printReport(website);
          } catch (e) {
            toast((e as Error).message, "info");
          }
        }}
      >
        <FileDown size={16} /> PDF quality report
      </button>
    </div>
  );
}
