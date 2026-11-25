"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Maximize2, Sparkles } from "lucide-react";
import { readSnapshot, download, previewDocument } from "@/lib/studio";
export default function SharedPreview() {
  const [snapshot, setSnapshot] = useState<{ name: string; html: string }>(),
    [error, setError] = useState(""),
    [present, setPresent] = useState(false);
  useEffect(() => {
    let active = true;
    const load = () => {
      setError("");
      void readSnapshot(location.hash.slice(1))
        .then((s) => {
          if (active) setSnapshot(s);
        })
        .catch(() => {
          if (active)
            setError(
              "This snapshot link is missing, invalid, or too large. Ask its creator for a new link.",
            );
        });
    };
    load();
    window.addEventListener("hashchange", load);
    return () => {
      active = false;
      window.removeEventListener("hashchange", load);
    };
  }, []);
  return (
    <main className={`sc-shared ${present ? "sc-shared-present" : ""}`}>
      {!present && (
        <header>
          <Link href="/" className="sc-logo">
            <Sparkles /> SiteCraft AI
          </Link>
          <div>
            <b>{snapshot?.name || "Shared preview"}</b>
            <span className="sc-small sc-muted">
              Read-only snapshot · Draft content · Not a live deployment
            </span>
          </div>
          <button
            className="sc-icon"
            aria-label="Presentation mode"
            onClick={() => setPresent(true)}
          >
            <Maximize2 size={18} />
          </button>
          {snapshot && (
            <button
              className="sc-btn sc-btn-outline sc-btn-sm"
              onClick={() =>
                download(snapshot.html, "shared-site.html", "text/html")
              }
            >
              <ExternalLink size={15} /> Download HTML
            </button>
          )}
        </header>
      )}
      {present && (
        <button
          className="sc-exit-present sc-btn sc-btn-dark"
          onClick={() => setPresent(false)}
        >
          Exit presentation
        </button>
      )}
      {error ? (
        <div className="sc-empty" role="alert">
          <h1>Preview unavailable</h1>
          <p>{error}</p>
          <Link href="/playground" className="sc-btn sc-btn-dark">
            Explore SiteCraft
          </Link>
        </div>
      ) : snapshot ? (
        <iframe
          title={snapshot.name}
          srcDoc={previewDocument(snapshot.html, "share", false, false)}
          sandbox="allow-scripts allow-forms allow-popups"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className="sc-empty">Opening snapshot…</div>
      )}
    </main>
  );
}
