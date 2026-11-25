"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Eye, Check } from "lucide-react";
import {
  fonts,
  templateWebsite,
  prepareTemplate,
  type Template,
} from "@/lib/templates";
import { toast } from "./ToastViewport";
export function TemplateCard({
  template,
  compact = false,
}: {
  template: Template;
  compact?: boolean;
}) {
  const router = useRouter();
  const [accent, setAccent] = useState(template.accent),
    [font, setFont] = useState(() => templateWebsite(template).plan.fontFamily),
    [prompt, setPrompt] = useState(false);
  const html = useMemo(
    () => templateWebsite(template, { accent, font }).html,
    [template, accent, font],
  );
  return (
    <article className="sc-template-card">
      <Link
        href={`/playground?template=${template.id}`}
        className="sc-thumb"
        aria-label={`Preview ${template.name}`}
      >
        <iframe
          title={`${template.name} style preview`}
          srcDoc={html}
          sandbox=""
          tabIndex={-1}
          loading="lazy"
        />
        <span className="sc-thumb-hover">
          <Eye size={18} /> Explore template
        </span>
      </Link>
      <div className="sc-template-body">
        <div className="sc-row-between">
          <span className="sc-tag">{template.industry}</span>
          <span className="sc-muted sc-small">{template.tag}</span>
        </div>
        <h3>{template.name}</h3>
        {!compact && (
          <>
            <div className="sc-row-between">
              <div
                className="sc-swatches"
                aria-label={`${template.name} accent colors`}
              >
                {[template.accent, "#6554c0", "#216e65", "#d94e32"]
                  .filter((c, i, a) => a.indexOf(c) === i)
                  .map((c) => (
                    <button
                      key={c}
                      aria-label={`Use ${c} accent for ${template.name}`}
                      aria-pressed={accent === c}
                      style={{ background: c }}
                      onClick={() => setAccent(c)}
                    >
                      {accent === c && <Check size={13} color="white" />}
                    </button>
                  ))}
              </div>
              <label className="sc-small">
                Font{" "}
                <select
                  value={font}
                  onChange={(e) => setFont(e.target.value)}
                  aria-label={`Font for ${template.name}`}
                >
                  {fonts.map((f) => (
                    <option key={f}>{f}</option>
                  ))}
                </select>
              </label>
            </div>
            <button
              className="sc-text-btn"
              onClick={() => setPrompt(!prompt)}
              aria-expanded={prompt}
            >
              Example prompt {prompt ? "−" : "+"}
            </button>
            {prompt && (
              <div className="sc-example-prompt">
                <p>{template.prompt}</p>
                <button
                  className="sc-text-btn"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(template.prompt);
                      toast("Prompt copied");
                    } catch {
                      toast("Select and copy the prompt manually", "info");
                    }
                  }}
                >
                  <Copy size={14} /> Copy prompt
                </button>
              </div>
            )}
          </>
        )}
        <button
          className="sc-btn sc-btn-outline sc-full"
          onClick={() =>
            router.push(prepareTemplate(template, { accent, font }))
          }
        >
          Use template
        </button>
      </div>
    </article>
  );
}
