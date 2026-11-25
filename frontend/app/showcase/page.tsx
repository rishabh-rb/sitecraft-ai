"use client";
import Link from "next/link";
import { StudioNav } from "@/components/studio/StudioNav";
import { TemplateCard } from "@/components/studio/TemplateCard";
import { templates } from "@/lib/templates";
export default function ShowcasePage() {
  return (
    <div className="sc-site">
      <StudioNav />
      <main className="sc-container sc-gallery-page">
        <div className="sc-eyebrow">POSSIBILITY, IN PREVIEW</div>
        <h1>
          Different ideas.
          <br />
          <em>One creative studio.</em>
        </h1>
        <p className="sc-page-description">
          Explore curated template examples, then open one in the playground.
          <br />
          These are sample designs, ready for your own content and finishing
          touches.
        </p>
        <div className="sc-grid-2">
          {[templates[0], templates[1], templates[4], templates[2]].map((t) => (
            <TemplateCard template={t} key={t.id} compact />
          ))}
        </div>
        <div className="sc-gallery-foot">
          <h2>Make the next one yours.</h2>
          <Link href="/templates" className="sc-btn sc-btn-coral">
            Find your starting point
          </Link>
        </div>
      </main>
    </div>
  );
}
