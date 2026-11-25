"use client";
import { useState } from "react";
import { Sparkles } from "lucide-react";
import { templates } from "@/lib/templates";
export function VisualPrompt({
  onApply,
}: {
  onApply: (prompt: string) => void;
}) {
  const [goal, setGoal] = useState("Restaurant"),
    [audience, setAudience] = useState("new customers"),
    [tone, setTone] = useState("Warm and welcoming"),
    [color, setColor] = useState("earthy terracotta and cream"),
    [sections, setSections] = useState(["Hero", "About", "Contact"]);
  return (
    <div className="sc-visual-prompt">
      <label className="sc-field-label" htmlFor="vp-goal">
        What are you building?
      </label>
      <select
        id="vp-goal"
        className="sc-input"
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
      >
        {templates.map((t) => (
          <option key={t.id}>{t.industry}</option>
        ))}
      </select>
      <label className="sc-field-label" htmlFor="vp-audience">
        Who is it for?
      </label>
      <input
        id="vp-audience"
        className="sc-input"
        value={audience}
        maxLength={150}
        onChange={(e) => setAudience(e.target.value)}
      />
      <label className="sc-field-label" htmlFor="vp-tone">
        Tone & personality
      </label>
      <select
        id="vp-tone"
        className="sc-input"
        value={tone}
        onChange={(e) => setTone(e.target.value)}
      >
        {[
          "Warm and welcoming",
          "Minimal and refined",
          "Bold and playful",
          "Professional and calm",
        ].map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
      <label className="sc-field-label" htmlFor="vp-colors">
        Color direction
      </label>
      <input
        id="vp-colors"
        className="sc-input"
        value={color}
        maxLength={150}
        onChange={(e) => setColor(e.target.value)}
      />
      <span className="sc-field-label">Include these sections</span>
      <div className="sc-filter-chips sc-compact-chips">
        {[
          "Hero",
          "About",
          "Services",
          "Gallery",
          "Menu",
          "Pricing",
          "FAQ",
          "Contact",
        ].map((section) => (
          <button
            type="button"
            key={section}
            aria-pressed={sections.includes(section)}
            className={sections.includes(section) ? "is-active" : ""}
            onClick={() =>
              setSections(
                sections.includes(section)
                  ? sections.filter((s) => s !== section)
                  : [...sections, section],
              )
            }
          >
            {section}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="sc-btn sc-btn-coral sc-full"
        onClick={() =>
          onApply(
            `Create a responsive ${goal.toLowerCase()} website for ${audience}. The tone should be ${tone.toLowerCase()}. Use ${color}. Include ${sections.join(", ")} sections. Use accessible contrast, clear navigation and labeled forms. Mark sample content and avoid invented reviews, claims or statistics.`,
          )
        }
      >
        <Sparkles size={15} /> Build my prompt
      </button>
    </div>
  );
}
