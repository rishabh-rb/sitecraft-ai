"use client";
import { useEffect, useMemo, useState } from "react";
import { StudioWorkspace } from "@/components/studio/StudioWorkspace";
import { templates, templateWebsite } from "@/lib/templates";
export default function Playground() {
  const [template, setTemplate] = useState(templates[0]),
    [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => {
      setTemplate(
        templates.find(
          (t) => t.id === new URLSearchParams(location.search).get("template"),
        ) || templates[0],
      );
      setReady(true);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const website = useMemo(() => templateWebsite(template), [template]);
  if (!ready)
    return <div className="sc-workspace-loading">Opening playground…</div>;
  return (
    <StudioWorkspace
      key={template.id}
      id={`playground-${template.id}`}
      name={template.name}
      initialPrompt={template.prompt}
      website={website}
      demo
    />
  );
}
