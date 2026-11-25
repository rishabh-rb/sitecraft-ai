"use client";
import { useState } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { StudioNav } from "@/components/studio/StudioNav";
import { TemplateCard } from "@/components/studio/TemplateCard";
import { templates } from "@/lib/templates";
export default function TemplatesPage() {
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("All templates");
  const items = templates.filter(
    (t) =>
      (category === "All templates" || category === t.industry) &&
      `${t.name} ${t.industry} ${t.tag}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  return (
    <div className="sc-site">
      <StudioNav />
      <main className="sc-container sc-gallery-page">
        <div className="sc-eyebrow">THE TEMPLATE COLLECTION</div>
        <h1>
          A little inspiration.
          <br />
          <em>A lot of possibility.</em>
        </h1>
        <p className="sc-page-description">
          Eight starting points. Endless ways to make them yours.
          <br />
          Explore a style, tune the colors and take your next idea into the
          studio.
        </p>
        <div className="sc-filter-toolbar">
          <div className="sc-search">
            <Search size={18} />
            <input
              aria-label="Search templates"
              placeholder="Search templates or styles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="sc-muted sc-small">
            <SlidersHorizontal size={15} /> {items.length} templates · Free to
            explore
          </span>
        </div>
        <div className="sc-filter-chips" aria-label="Template industries">
          {["All templates", ...templates.map((t) => t.industry)].map((c) => (
            <button
              key={c}
              className={c === category ? "is-active" : ""}
              aria-pressed={c === category}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        {items.length ? (
          <div className="sc-grid-3">
            {items.map((t) => (
              <TemplateCard template={t} key={t.id} />
            ))}
          </div>
        ) : (
          <div className="sc-empty">
            <Search size={36} />
            <h2>No matching templates</h2>
            <p>Try another name or choose a different industry.</p>
            <button
              className="sc-btn sc-btn-outline"
              onClick={() => {
                setSearch("");
                setCategory("All templates");
              }}
            >
              Clear filters
            </button>
          </div>
        )}
        <div className="sc-gallery-foot">
          <h2>Have something else in mind?</h2>
          <p>
            Start with a blank brief and let SiteCraft find a direction for you.
          </p>
          <a href="/dashboard" className="sc-btn sc-btn-dark">
            Create from an idea
          </a>
        </div>
      </main>
    </div>
  );
}
