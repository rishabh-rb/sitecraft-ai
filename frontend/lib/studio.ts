import type { GeneratedWebsite } from "./api";
import {
  escapeHtml,
  templates,
  templateWebsite,
  type DesignOptions,
} from "./templates";

export function readLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
  } catch {
    return fallback;
  }
}
export function saveLocal(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
export function download(
  content: Blob | string,
  name: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(
    content instanceof Blob ? content : new Blob([content], { type }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name.replace(/[/\\]/g, "-");
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
export function documentFor(html: string) {
  return new DOMParser().parseFromString(html, "text/html");
}
export function sectionNodes(doc: Document): HTMLElement[] {
  const found = Array.from(doc.querySelectorAll<HTMLElement>("section")).filter(
    (node) => !node.parentElement?.closest("section"),
  );
  return found.length
    ? found
    : Array.from(
        doc.querySelectorAll<HTMLElement>(
          "main > div, body > header, body > footer",
        ),
      );
}
export function sectionList(html: string) {
  return sectionNodes(documentFor(html)).map((node, index) => ({
    index,
    title:
      Array.from(node.querySelector("h1,h2,h3")?.childNodes || [])
        .map((part) => part.textContent?.trim())
        .filter(Boolean)
        .join(" ")
        .slice(0, 60) ||
      node.id ||
      `Section ${index + 1}`,
    text: node.querySelector("p")?.textContent || "",
    image: node.querySelector("img")?.getAttribute("src") || "",
  }));
}
export function updateSection(
  html: string,
  index: number,
  action: string,
  value = "",
): string {
  const doc = documentFor(html),
    nodes = sectionNodes(doc),
    node = nodes[index];
  if (!node) return html;
  if (action === "remove") node.remove();
  if (action === "duplicate") {
    const clone = node.cloneNode(true) as HTMLElement;
    const suffix = `-copy-${Date.now()}`;
    if (clone.id) clone.id += suffix;
    clone.querySelectorAll<HTMLElement>("[id]").forEach((el) => {
      const old = el.id;
      el.id += suffix;
      clone.querySelectorAll("label").forEach((label) => {
        if (label.htmlFor === old) label.htmlFor = el.id;
      });
    });
    node.after(clone);
  }
  if (action === "up" && index > 0) nodes[index - 1].before(node);
  if (action === "down" && nodes[index + 1]) nodes[index + 1].after(node);
  if (action === "title") {
    const title = node.querySelector("h1,h2,h3");
    if (title) title.textContent = value;
  }
  if (action === "copy") {
    const text = node.querySelector("p");
    if (text) text.textContent = value;
  }
  if (action === "color" && /^#[0-9a-f]{6}$/i.test(value)) {
    node.style.backgroundColor = value;
    node.style.color = luminance(value) > 0.4 ? "#171b19" : "#ffffff";
  }
  if (action === "layout") {
    node.style.display = "flex";
    node.style.flexDirection = value === "stack" ? "column" : "row-reverse";
    node.style.alignItems = "center";
    node.style.gap = "32px";
    node.style.flexWrap = "wrap";
    Array.from(node.children).forEach((child) => {
      (child as HTMLElement).style.maxWidth = "100%";
    });
  }
  if (
    action === "image" &&
    /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(value)
  ) {
    const img = node.querySelector("img");
    if (img) img.src = value;
  }
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}
export function applyDesign(
  html: string,
  design: DesignOptions,
  oldAccent?: string,
) {
  let source = html;
  if (oldAccent && /^#[a-f0-9]{6}$/i.test(oldAccent))
    source = source.replace(new RegExp(oldAccent, "gi"), design.accent);
  const doc = documentFor(source);
  doc.getElementById("sitecraft-design")?.remove();
  const style = doc.createElement("style");
  style.id = "sitecraft-design";
  style.textContent = `:root{--brand:${design.accent};--primary:${design.accent};--radius:${design.radius}px;--space:${design.spacing}px;--page:${design.width}px;--surface:${design.dark ? "#171c1b" : "#f8f5ef"};--ink:${design.dark ? "#f4f3ec" : "#20251f"}}body{font-family:'${design.font.replace(/[^a-zA-Z ]/g, "")}',sans-serif!important;background:var(--surface)!important;color:var(--ink)!important}main{max-width:${design.width}px!important;margin-inline:auto!important}section{padding-top:${design.spacing}px!important;padding-bottom:${design.spacing}px!important}button,input,.card{border-radius:${design.radius}px!important}a.cta,button.cta{background:${design.accent}!important;color:white!important}`;
  doc.head.append(style);
  if (
    design.logo &&
    /^(https:\/\/|data:image\/(png|jpeg|webp);base64,)/.test(design.logo)
  ) {
    const brand = doc.querySelector(".brand,.logo,header nav > a,nav > a");
    if (brand) {
      let img = brand.querySelector("img");
      if (!img) {
        img = doc.createElement("img");
        img.style.cssText =
          "max-width:100px;max-height:40px;vertical-align:middle;margin-right:12px";
        brand.prepend(img);
      }
      if (!img.hasAttribute("data-sc-logo"))
        img.setAttribute("data-sc-original-src", img.getAttribute("src") || "");
      img.setAttribute("data-sc-logo", "true");
      img.src = design.logo;
      img.alt = "Brand logo";
    }
  } else
    doc
      .querySelectorAll<HTMLImageElement>("img[data-sc-logo]")
      .forEach((img) => {
        const original = img.getAttribute("data-sc-original-src");
        if (original) {
          img.src = original;
          img.removeAttribute("data-sc-logo");
          img.removeAttribute("data-sc-original-src");
        } else img.remove();
      });
  return "<!doctype html>\n" + doc.documentElement.outerHTML;
}
export function previewDocument(
  html: string,
  channel: string,
  selection: boolean,
  collaborators: boolean,
) {
  const doc = documentFor(html);
  sectionNodes(doc).forEach((node, i) =>
    node.setAttribute("data-sc-section", String(i)),
  );
  const style = doc.createElement("style");
  style.textContent = `${selection ? "[data-sc-section]{cursor:crosshair!important}[data-sc-section]:hover{outline:3px solid #e45f45!important;outline-offset:-3px}" : ""}#sc-demo-cursor{position:fixed;top:35%;left:66%;z-index:2147483647;pointer-events:none;background:#6d5dfc;color:white;border-radius:3px 14px 14px;padding:5px 12px;font:12px Arial;box-shadow:0 4px 20px #0002;animation:sc-drift 7s ease-in-out infinite alternate}@keyframes sc-drift{to{transform:translate(-140px,70px)}}@media(prefers-reduced-motion:reduce){#sc-demo-cursor{animation:none}}`;
  doc.head.append(style);
  if (collaborators) {
    const cursor = doc.createElement("div");
    cursor.id = "sc-demo-cursor";
    cursor.textContent = "Priya · demo cursor";
    doc.body.append(cursor);
  }
  const script = doc.createElement("script");
  script.textContent = `document.addEventListener('click',function(e){if(${selection}){var n=e.target.closest('[data-sc-section]');if(n){e.preventDefault();e.stopImmediatePropagation();parent.postMessage({type:'sitecraft-select',channel:${JSON.stringify(channel)},index:Number(n.dataset.scSection)},'*');return}}var a=e.target.closest('a');var href=a&&a.getAttribute('href');if(href&&href.startsWith('#')){e.preventDefault();var target=document.getElementById(decodeURIComponent(href.slice(1)));if(target)target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})}},true);`;
  doc.body.append(script);
  return "<!doctype html>" + doc.documentElement.outerHTML;
}
function luminance(hex: string) {
  const c = hex
    .replace("#", "")
    .match(/../g)
    ?.map((n) => {
      const s = parseInt(n, 16) / 255;
      return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
    }) || [0, 0, 0];
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
export type AuditCheck = {
  category: "Accessibility" | "SEO" | "Performance";
  name: string;
  passed: boolean;
  detail: string;
};
export function auditWebsite(
  html: string,
  palette: Record<string, string> = {},
) {
  const doc = documentFor(html),
    images = Array.from(doc.images),
    headings = Array.from(doc.querySelectorAll("h1,h2,h3,h4,h5,h6"));
  const inputs = Array.from(
    doc.querySelectorAll<HTMLInputElement>(
      "input:not([type=hidden]):not([type=submit]),textarea,select",
    ),
  );
  const title = doc.title,
    desc =
      doc.querySelector('meta[name="description"]')?.getAttribute("content") ||
      "";
  const bytes = new TextEncoder().encode(html).length;
  const colors = Object.values(palette).filter((s) =>
    /^#[a-f0-9]{6}$/i.test(s),
  );
  const fg = palette.text || colors[colors.length - 1],
    bg = palette.background || "#ffffff";
  const contrast =
    fg && /^#[a-f0-9]{6}$/i.test(fg) && /^#[a-f0-9]{6}$/i.test(bg)
      ? (Math.max(luminance(fg), luminance(bg)) + 0.05) /
        (Math.min(luminance(fg), luminance(bg)) + 0.05)
      : null;
  const checks: AuditCheck[] = [
    {
      category: "Accessibility",
      name: "Document language",
      passed: !!doc.documentElement.lang,
      detail: doc.documentElement.lang || "Add a language to the HTML element.",
    },
    {
      category: "Accessibility",
      name: "Image alternatives",
      passed: images.every((img) => img.hasAttribute("alt")),
      detail: `${images.filter((img) => img.hasAttribute("alt")).length}/${images.length} images have an alt attribute. Review their quality manually.`,
    },
    {
      category: "Accessibility",
      name: "Form labels",
      passed: inputs.every(
        (input) =>
          !!input.getAttribute("aria-label") ||
          !!input.getAttribute("aria-labelledby") ||
          Array.from(doc.querySelectorAll("label")).some(
            (l) => (l.htmlFor === input.id && !!input.id) || l.contains(input),
          ),
      ),
      detail: `${inputs.length} fields inspected for associated labels.`,
    },
    {
      category: "Accessibility",
      name: "Heading order",
      passed: headings.every(
        (h, i) =>
          !i || Number(h.tagName[1]) <= Number(headings[i - 1].tagName[1]) + 1,
      ),
      detail:
        headings.map((h) => h.tagName).join(" → ") || "No headings found.",
    },
    {
      category: "Accessibility",
      name: "Palette contrast",
      passed: contrast !== null && contrast >= 4.5,
      detail: contrast
        ? `${contrast.toFixed(2)}:1 for plan text/background. Target 4.5:1. Other rendered pairs need review.`
        : "No valid text/background pair in the project palette.",
    },
    {
      category: "SEO",
      name: "Page title",
      passed: title.length >= 10 && title.length <= 70,
      detail: `${title.length} characters · ${title || "Missing title"}`,
    },
    {
      category: "SEO",
      name: "Meta description",
      passed: desc.length >= 40 && desc.length <= 180,
      detail: `${desc.length} characters · ${desc || "Add a search description."}`,
    },
    {
      category: "SEO",
      name: "One primary heading",
      passed: doc.querySelectorAll("h1").length === 1,
      detail: `${doc.querySelectorAll("h1").length} H1 elements found.`,
    },
    {
      category: "SEO",
      name: "Social metadata",
      passed:
        !!doc.querySelector('meta[property="og:title"]') &&
        !!doc.querySelector('meta[property="og:description"]'),
      detail:
        "Checks Open Graph title and description. Add a hosted social image before launch.",
    },
    {
      category: "Performance",
      name: "HTML size",
      passed: bytes < 150000,
      detail: `${(bytes / 1024).toFixed(1)} KB of HTML; external resources are additional.`,
    },
    {
      category: "Performance",
      name: "Image dimensions",
      passed: images.every(
        (img) => !!img.getAttribute("width") && !!img.getAttribute("height"),
      ),
      detail: "Explicit image dimensions reduce layout shifts.",
    },
    {
      category: "Performance",
      name: "Offscreen image loading",
      passed: images.slice(1).every((img) => img.loading === "lazy"),
      detail:
        "Images after the first should load lazily. This is a source heuristic.",
    },
  ];
  const score = (category?: string) => {
    const group = checks.filter((c) => !category || c.category === category);
    return Math.round(
      (100 * group.filter((c) => c.passed).length) / group.length,
    );
  };
  return {
    checks,
    score,
    bytes,
    title,
    description: desc,
    headings: headings.map((h) => ({
      tag: h.tagName,
      text: h.textContent?.slice(0, 100),
    })),
    keywords:
      doc.querySelector('meta[name="keywords"]')?.getAttribute("content") ||
      "Not provided",
  };
}
export async function exportZip(website: GeneratedWebsite, name: string) {
  const JSZip = (await import("jszip")).default,
    zip = new JSZip();
  website.files.forEach((f) =>
    zip.file(`ai-source/${f.path.replace(/(^\/|\.\.[/\\])/g, "")}`, f.content),
  );
  zip.file("index.html", website.html);
  zip.file(
    "README.md",
    "# SiteCraft AI export\n\nindex.html is your current visual draft. ai-source/ contains the last generated source files; visual edits may not be reflected there. Connect forms, verify content and check accessibility before publishing.\n",
  );
  download(await zip.generateAsync({ type: "blob" }), `${name}.zip`);
}
export function printReport(website: GeneratedWebsite) {
  const report = auditWebsite(website.html, website.plan.colorPalette),
    popup = window.open("", "_blank");
  if (!popup) throw new Error("Allow pop-ups to print the report.");
  popup.opener = null;
  popup.document.write(
    `<!doctype html><html><head><title>SiteCraft Launch Report</title><style>body{font:15px Arial;margin:48px;color:#202522}h1{font-size:36px}table{border-collapse:collapse;width:100%}td,th{padding:12px;border-bottom:1px solid #ddd;text-align:left}small{color:#555}@media print{button{display:none}}</style></head><body><h1>SiteCraft Launch Report</h1><p>${escapeHtml(website.plan.siteName)}</p><h2>${report.score()}/100 static checks passed</h2><p>Source-based estimates, not Lighthouse results or WCAG certification. Review live behavior, business content, forms and links before publishing.</p><table><tr><th>Category</th><th>Check</th><th>Result</th></tr>${report.checks.map((c) => `<tr><td>${c.category}</td><td>${escapeHtml(c.name)}<br><small>${escapeHtml(c.detail)}</small></td><td>${c.passed ? "Pass" : "Review"}</td></tr>`).join("")}</table><p>Created ${new Date().toLocaleString()}</p><button onclick="window.print()">Print / Save as PDF</button></body></html>`,
  );
  popup.document.close();
  popup.focus();
  setTimeout(() => popup.print(), 400);
}
function fingerprint(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++)
    hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(36);
}
// Reuse exact chunks from the bundled template when possible, keeping QR links short.
// The fingerprint prevents a future template change from silently corrupting an old snapshot.
function templateDelta(
  base: string,
  html: string,
): Array<string | [number, number]> {
  const lookup = new Map<string, number[]>();
  for (let i = 0; i < base.length - 15; i++) {
    const token = base.slice(i, i + 16);
    const list = lookup.get(token) || [];
    if (list.length < 8) list.push(i);
    lookup.set(token, list);
  }
  const result: Array<string | [number, number]> = [];
  let pending = "",
    position = 0;
  while (position < html.length) {
    const matches = lookup.get(html.slice(position, position + 16)) || [];
    let start = -1,
      length = 0;
    for (const candidate of matches) {
      let n = 16;
      while (
        base[candidate + n] === html[position + n] &&
        position + n < html.length &&
        candidate + n < base.length
      )
        n++;
      if (n > length) {
        start = candidate;
        length = n;
      }
    }
    if (length >= 24) {
      if (pending) {
        result.push(pending);
        pending = "";
      }
      result.push([start, length]);
      position += length;
    } else pending += html[position++];
  }
  if (pending) result.push(pending);
  return result;
}
export async function snapshotUrl(website: GeneratedWebsite) {
  if (website.html.length > 1200000)
    throw new Error(
      "This draft is too large for a portable link. Export HTML instead.",
    );
  let payload: object = { name: website.plan.siteName, html: website.html };
  let best = JSON.stringify(payload).length;
  for (const template of templates) {
    const base = templateWebsite(template).html;
    const candidate = {
      name: website.plan.siteName,
      template: template.id,
      fingerprint: fingerprint(base),
      parts: templateDelta(base, website.html),
    };
    const length = JSON.stringify(candidate).length;
    if (length < best) {
      payload = candidate;
      best = length;
    }
  }
  const data = new TextEncoder().encode(JSON.stringify(payload));
  if (data.length > 1200000)
    throw new Error(
      "This draft is too large for a portable link. Export HTML or publish the server version.",
    );
  const packed = new Uint8Array(
    await new Response(
      new Blob([data]).stream().pipeThrough(new CompressionStream("gzip")),
    ).arrayBuffer(),
  );
  let binary = "";
  for (const byte of packed) binary += String.fromCharCode(byte);
  return `${location.origin}/share#${btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
}
export async function readSnapshot(
  hash: string,
): Promise<{ name: string; html: string }> {
  if (hash.length > 1700000) throw new Error("Snapshot link is too large.");
  const binary = atob(hash.replace(/-/g, "+").replace(/_/g, "/"));
  const stream = new Blob([Uint8Array.from(binary, (c) => c.charCodeAt(0))])
    .stream()
    .pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1200000) {
      await reader.cancel();
      throw new Error("Snapshot exceeds the size limit.");
    }
    chunks.push(value);
  }
  const payload = JSON.parse(await new Blob(chunks as BlobPart[]).text());
  if (typeof payload.name !== "string") throw new Error("Invalid snapshot.");
  if (payload.template) {
    const template = templates.find((t) => t.id === payload.template);
    if (
      !template ||
      !Array.isArray(payload.parts) ||
      payload.parts.length > 20000
    )
      throw new Error("Invalid template snapshot.");
    const base = templateWebsite(template).html;
    if (fingerprint(base) !== payload.fingerprint)
      throw new Error(
        "The template library changed. Ask for a fresh snapshot link.",
      );
    let html = "";
    for (const part of payload.parts) {
      if (typeof part === "string") html += part;
      else if (
        Array.isArray(part) &&
        part.length === 2 &&
        part.every(Number.isInteger) &&
        part[0] >= 0 &&
        part[1] >= 0 &&
        part[0] + part[1] <= base.length
      )
        html += base.slice(part[0], part[0] + part[1]);
      else throw new Error("Invalid snapshot chunk.");
      if (html.length > 1200000)
        throw new Error("Snapshot exceeds the size limit.");
    }
    payload.html = html;
  }
  if (typeof payload.html !== "string") throw new Error("Invalid snapshot.");
  return { name: payload.name.slice(0, 150), html: payload.html };
}
