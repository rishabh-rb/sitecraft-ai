import { parse, type DefaultTreeAdapterTypes as Html } from "parse5";
import type { GeneratedSitePayload } from "./types.js";

export type LaunchCheck = {
  label: string;
  status: "pass" | "review" | "fail" | "not-applicable";
  detail: string;
};

export type LaunchRequirement = {
  label: string;
  excerpt: string;
  status: "covered" | "partial" | "missing" | "omitted" | "unexpected";
  evidence: string;
};

export type LaunchReport = {
  score: number;
  coverage: { covered: number; total: number };
  requirements: LaunchRequirement[];
  checks: LaunchCheck[];
  checklist: LaunchCheck[];
  claims: string[];
  missingContent: string[];
};

type Element = Html.Element;
type Artifact = Pick<GeneratedSitePayload, "html" | "files">;
const attr = (node: Element, name: string) => node.attrs.find((item) => item.name === name)?.value;
const clean = (value: string) => value.replace(/\s+/g, " ").trim();
const hiddenTags = new Set(["script", "style", "template", "noscript", "svg", "head"]);

function hidden(node: Element) {
  const classes = attr(node, "class") ?? "";
  return attr(node, "hidden") !== undefined ||
    /display\s*:\s*none|visibility\s*:\s*hidden/i.test(attr(node, "style") ?? "") ||
    (classes.split(/\s+/).includes("hidden") && !/\b(?:sm|md|lg|xl|2xl):(?:flex|grid|block|inline)/.test(classes));
}

function readTree(root: Html.Node) {
  const elements: Element[] = [];
  const words: string[] = [];
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if ("tagName" in node) {
      if (node !== root && (hiddenTags.has(node.tagName) || hidden(node))) continue;
      elements.push(node);
    }
    if ("value" in node) words.push(node.value);
    if ("childNodes" in node) {
      for (const child of [...node.childNodes].reverse()) pending.push(child);
    }
  }
  return { elements, text: clean(words.join(" ")) };
}

const textOf = (node: Element) => readTree(node).text;

function allElements(root: Html.Node) {
  const elements: Element[] = [];
  const pending = [root];
  while (pending.length) {
    const node = pending.pop()!;
    if ("tagName" in node) elements.push(node);
    if ("childNodes" in node) pending.push(...node.childNodes);
  }
  return elements;
}

const claimPatterns = [
  /\b(?:trusted|used|loved|chosen) by\s+(?:over\s+)?\d[\d,.]*\+?(?:\s+(?:customers|clients|users|members|companies|businesses))?/gi,
  /\b(?:award[- ]winning|industry[- ]leading|(?:winner|recipient) of [\w -]{3,70}|most popular)\b/gi,
  /\b\d[\d,.]*(?:\s?[kmb]|\+)?\s+(?:customers|clients|users|members|reviews|companies|businesses|downloads)\b/gi,
  /\b\d+(?:\.\d+)?\s*%\s+(?:uptime|faster|growth|satisfaction|success rate|conversion|accuracy|guaranteed)\b/gi,
  /\b\d+(?:\.\d+)?\s*(?:\/\s*5|[- ]stars?)\b/gi
];

export function unverifiedClaims(text: string, briefs: readonly string[]) {
  const supplied = clean(briefs.join(" ")).toLowerCase();
  const matches = claimPatterns.flatMap((pattern) => [...text.matchAll(pattern)].map((match) => match[0].trim()));
  return [...new Set(matches.filter((claim) => !supplied.includes(claim.toLowerCase())))].slice(0, 10);
}

function previewClaims(elements: Element[], text: string, briefs: readonly string[]) {
  const source = clean(briefs.join(" ")).toLowerCase();
  const quotes = elements.filter((node) => /testimonials?|reviews?/.test(attr(node, "id") ?? "") ||
    (node.tagName === "blockquote" && (attr(node, "cite") !== undefined ||
      elements.some((parent) => /testimonials?|reviews?/.test(attr(parent, "id") ?? "") && contains(parent, node)))));
  const unverified = quotes.some((node) => {
    const copy = textOf(node);
    const citations = node.tagName === "blockquote" ? [copy] :
      [...copy.matchAll(/[“"]([^”"]{15,})[”"]/g)].map((match) => match[1]);
    return citations.some((quote) => quote.length > 0 && !source.includes(quote.toLowerCase()));
  });
  return [...unverifiedClaims(text, briefs), ...(unverified ? ["Customer quotation without a source in the brief"] : [])];
}

export function riskyPreviewClaims(html: string, briefs: readonly string[]) {
  const { elements, text } = readTree(parse(html));
  return previewClaims(elements, text, briefs);
}

const rules = [
  ["Restaurant menu", /\b(?:food menu|restaurant menu|menu|menu items)\b/i, /\b(?:menu|made for the table)\b/i, "section"],
  ["Reservation form", /\b(?:reservations?|table booking|reserve a table|book a table)\b/i, /\b(?:reservations?|reserve|table booking)\b/i, "reservation"],
  ["Contact form", /\b(?:contact|inquiry|enquiry|lead)\s+form\b/i, /\b(?:contact|inquiry|enquiry|get in touch)\b/i, "form"],
  ["Customer reviews", /\b(?:reviews?|testimonials?|social proof)\b/i, /\b(?:reviews?|testimonials?|customer stories)\b/i, "reviews"],
  ["Pricing", /\b(?:pricing|price list|pricing tiers|subscription plans)\b/i, /\b(?:pricing|price list|scalable plans)\b/i, "section"],
  ["FAQ", /\b(?:faq|frequently asked questions)\b/i, /\b(?:faq|frequently asked questions|common questions)\b/i, "section"],
  ["About or story", /\b(?:about (?:us|page|section)|(?:our|brand|restaurant) story|story)\b/i, /\b(?:about|our story|closer look)\b/i, "section"],
  ["Location", /\b(?:location|address|map|directions)\b/i, /\b(?:location|address|directions|find us)\b/i, "section"],
  ["Portfolio projects", /\b(?:case studies|selected work|projects)\b/i, /\b(?:selected work|projects|case studies|work with intention)\b/i, "section"],
  ["Product catalogue", /\b(?:product grid|catalogue?|featured products|product listings)\b/i, /\b(?:products?|catalogue?|collection)\b/i, "section"],
  ["Shopping cart", /\b(?:cart|shopping bag|basket)\b/i, /\b(?:cart|shopping bag|basket)\b/i, "control"],
  ["Checkout", /\bcheckout\b/i, /\bcheckout\b/i, "control"],
  ["Search", /\b(?:search bar|search box|search|filter controls)\b/i, /\b(?:search|filter)\b/i, "control"],
  ["Newsletter signup", /\b(?:newsletter|mailing list|email signup)\b/i, /\b(?:newsletter|mailing list|subscribe)\b/i, "form"],
  ["Event schedule", /\b(?:schedule|agenda|itinerary)\b/i, /\b(?:schedule|agenda|itinerary)\b/i, "section"],
  ["Photo gallery", /\b(?:photo gallery|image gallery|gallery)\b/i, /\b(?:gallery|photos)\b/i, "section"],
  ["Tickets or registration", /\b(?:tickets?|registration|rsvp)\b/i, /\b(?:tickets?|registration|rsvp)\b/i, "control"],
  ["Services", /\bservices\b/i, /\bservices\b/i, "section"],
  ["Mobile responsive", /\b(?:mobile[- ](?:friendly|first|responsive|layout)|responsive|on mobile)\b/i, /./, "mobile"],
  ["Accessibility", /\b(?:accessible|accessibility|wcag)\b/i, /./, "access"]
] as const;

function contains(parent: Element, node: Element): boolean {
  let ancestor = node.parentNode;
  while (ancestor && "tagName" in ancestor) {
    if (ancestor === parent) return true;
    ancestor = ancestor.parentNode;
  }
  return false;
}

function trace(briefs: readonly string[], elements: Element[], mobile: boolean, accessible: boolean): LaunchRequirement[] {
  const clauses = briefs.flatMap((brief) => brief.split(/[.!?;\n]+|,\s+|\b(?:but|and)\s+(?=(?:no|without|avoid|omit|exclude|remove|skip|do not)\b)/i));
  const sections = elements.filter((node) => /^(section|h[1-6])$/.test(node.tagName));
  return rules.flatMap(([label, request, pattern, kind]) => {
    const clause = [...clauses].reverse().find((value) => request.test(value));
    if (!clause) return [];
    const match = clause.match(request)!;
    const prefix = clause.slice(0, match.index).split(/\b(?:and|with)\b/i).at(-1) ?? "";
    const excluded = /\b(?:no|without|avoid|omit|exclude|remove|skip|do not (?:add|include)|don['’]t (?:add|include))\b/i.test(prefix) ||
      /^\s+(?:is\s+)?not (?:requested|needed|required)/i.test(clause.slice(match.index! + match[0].length));
    const identifyingText = (node: Element) => clean([attr(node, "id")?.replace(/[-_]/g, " "), attr(node, "aria-label"), attr(node, "placeholder"), textOf(node)].filter(Boolean).join(" "));
    const section = sections.find((node) => pattern.test(node.tagName === "section"
      ? (attr(node, "id") ?? "").replace(/[-_]/g, " ") : identifyingText(node)));
    const sectionId = section && attr(section, "id");
    let evidence = section ? sectionId ? "Preview target #" + sectionId : "Heading “" + textOf(section).slice(0, 80) + "”" : "";
    let present = Boolean(section);
    let partial = false;

    if (kind === "mobile" || kind === "access") {
      present = kind === "mobile" ? mobile : accessible;
      evidence = kind === "mobile" ? "Viewport and responsive layout rules found." : "Sampled accessibility markup checks passed.";
    }
    if (kind === "form" || kind === "reservation") {
      const form = elements.find((node) => node.tagName === "form" && (pattern.test(identifyingText(node)) ||
        sections.some((parent) => parent.tagName === "section" && contains(parent, node) &&
          (pattern.test((attr(parent, "id") ?? "").replace(/[-_]/g, " ")) || (section && contains(parent, section))))));
      present = Boolean(form);
      partial = (!present && Boolean(section)) || Boolean(kind === "reservation" && form && !/\b(?:date|time|guests|party size)\b/i.test(textOf(form)));
      if (form) evidence = partial ? "Reservation form found. Add date, time, or guest fields." : "Matching form found in the preview. Delivery requires verification.";
    }
    if (kind === "control") {
      present = elements.some((node) => /^(button|input|a|select)$/.test(node.tagName) && pattern.test(identifyingText(node)));
      partial = present || Boolean(section);
      if (partial) evidence = "Matching UI found. Verify the interaction in the preview.";
    }
    if (kind === "reviews" && present) {
      const reviewSection = section?.tagName === "section" ? section : sections.find((node) => node.tagName === "section" && section && contains(node, section));
      const reviewCopy = reviewSection && textOf(reviewSection);
      partial = !reviewCopy || !/[“"][^”"]{12,}[”"]/.test(reviewCopy) &&
        !elements.some((node) => node.tagName === "blockquote" && reviewSection && contains(reviewSection, node));
      if (partial) evidence = "Review section found. Add verified customer quotes.";
    }
    const status: LaunchRequirement["status"] = excluded
      ? present || partial ? "unexpected" : "omitted"
      : partial ? "partial" : present ? "covered" : "missing";
    return [{
      label, excerpt: clean(clause).slice(0, 180), status,
      evidence: status === "omitted" ? "Requested omission respected." :
        status === "missing" ? "No matching evidence in the preview." : evidence || "Matching preview markup found."
    }];
  });
}

function contrast(css: string, body: Element | undefined) {
  const declarations = [...css.matchAll(/(?:^|[}\n])\s*body\s*\{([^{}]*)\}/g)].map((match) => match[1]);
  if (body) declarations.push(attr(body, "style") ?? "");
  const hex = (property: RegExp) => {
    const raw = [...declarations.join(";").matchAll(property)].at(-1)?.[1].trim();
    const variable = raw?.match(/^var\((--[\w-]+)\)$/)?.[1];
    const value = variable ? css.match(new RegExp(variable + "\\s*:\\s*(#[0-9a-f]{6})(?![0-9a-f])", "i"))?.[1] : raw;
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value : undefined;
  };
  const foreground = hex(/(?:^|;)\s*color\s*:\s*([^;]+)/gi);
  const background = hex(/(?:^|;)\s*background(?:-color)?\s*:\s*([^;]+)/gi);
  if (!foreground || !background) return undefined;
  const luminance = (value: string) => [1, 3, 5].reduce((sum, offset, index) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    return sum + linear * [0.2126, 0.7152, 0.0722][index];
  }, 0);
  const values = [luminance(foreground), luminance(background)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}

function hasLabel(node: Element, nodes: Element[]) {
  const id = attr(node, "id");
  const refs = (attr(node, "aria-labelledby") ?? "").trim().split(/\s+/).filter(Boolean);
  return Boolean(attr(node, "aria-label")?.trim()) || nodes.some((candidate) =>
    ((refs.includes(attr(candidate, "id") ?? "")) || (candidate.tagName === "label" &&
      ((id && attr(candidate, "for") === id) || contains(candidate, node)))) && Boolean(textOf(candidate)));
}

function check(label: string, pass: boolean, detail: string): LaunchCheck {
  return { label, status: pass ? "pass" : "fail", detail };
}

export function createLaunchReport(site: Artifact, briefs: readonly string[], targets: readonly string[] = []): LaunchReport {
  const doc = parse(site.html);
  const all = allElements(doc);
  const { elements, text } = readTree(doc);
  const css = all.filter((node) => node.tagName === "style").map(textOf).join("\n");
  const responsive = /@media\s*[^{]*(?:width|orientation)/i.test(css) ||
    elements.some((node) => /(?:^|\s)(?:sm|md|lg|xl|2xl):(?:grid|flex|block|hidden|w-|max-w-|p[xy]?-)/.test(attr(node, "class") ?? ""));
  const viewport = all.some((node) => node.tagName === "meta" && attr(node, "name") === "viewport" && /width\s*=\s*device-width/i.test(attr(node, "content") ?? ""));
  const mobile = viewport && responsive;
  const fields = elements.filter((node) => /^(input|select|textarea)$/.test(node.tagName) &&
    !/^(hidden|submit|button|reset|image)$/i.test(attr(node, "type") ?? ""));
  const issues = [
    [all.some((node) => node.tagName === "html" && attr(node, "lang")?.trim()), "Set the document language."],
    [all.some((node) => node.tagName === "title" && textOf(node)), "Add a page title."],
    [elements.some((node) => node.tagName === "main" || attr(node, "role") === "main"), "Add a main landmark."],
    [elements.some((node) => node.tagName === "h1" && textOf(node)), "Add a descriptive H1."],
    [elements.filter((node) => node.tagName === "img").every((node) => attr(node, "alt") !== undefined), "Add image alt attributes."],
    [fields.every((node) => hasLabel(node, elements)), "Label visible input fields."]
  ] as const;
  const accessPassed = issues.filter(([pass]) => pass).length;
  const ratio = contrast(css, all.find((node) => node.tagName === "body"));
  const ids = new Set(elements.map((node) => attr(node, "id")));
  const links = [...new Set(elements.filter((node) => node.tagName === "a").map((node) => attr(node, "href")?.trim() ?? ""))];
  const broken = links.filter((url) => {
    if (!url || url === "#" || /^javascript:/i.test(url)) return true;
    if (!url.startsWith("#")) return false;
    try { return !ids.has(decodeURIComponent(url.slice(1))); } catch { return true; }
  });
  const hostedLinks = links.filter((url) => !url.startsWith("#") && !broken.includes(url)).length;
  const forms = elements.filter((node) => node.tagName === "form");
  const missingSubmit = forms.filter((form) => !elements.some((node) => {
    const type = attr(node, "type")?.toLowerCase();
    const submit = (node.tagName === "button" && (!type || type === "submit")) || (node.tagName === "input" && type === "submit");
    const owner = attr(node, "form");
    return submit && attr(node, "disabled") === undefined && (owner ? attr(form, "id") === owner : contains(form, node));
  })).length;
  const requirements = trace(briefs, elements, mobile, accessPassed === issues.length);
  const coverage = { covered: requirements.filter((item) => item.status === "covered" || item.status === "omitted").length, total: requirements.length };
  const claims = [...new Set([
    ...previewClaims(elements, text, briefs),
    ...site.files.flatMap((file) => /\.[jt]sx?$/.test(file.path) ? unverifiedClaims(file.content, briefs) : [])
  ])].slice(0, 10);
  const placeholders = [...new Set([...text.matchAll(/\b(?:lorem ipsum|coming soon|example pricing|your (?:company|business) name(?: here)?|add (?:verified |your )?(?:reviews?|testimonials?|address|pricing)|replace (?:me|this text))\b/gi)].map((match) => match[0]))].slice(0, 6);
  const missingContent = [
    ...requirements.filter((item) => item.status === "missing" || item.status === "partial").map((item) => item.label + " — " + item.evidence),
    ...placeholders.map((value) => "Review placeholder “" + value + "”.")
  ];
  const checks: LaunchCheck[] = [
    check("Responsive readiness", mobile, mobile ? "Viewport and responsive rules found. Check the rendered layout on a phone." : "Viewport or responsive layout rules are missing."),
    check("Accessibility score", accessPassed === issues.length, accessPassed + "/" + issues.length + " markup checks passed. " + issues.filter(([pass]) => !pass).map(([, issue]) => issue).join(" ")),
    ratio === undefined
      ? { label: "Contrast check", status: "review", detail: "Body colors could not be resolved from the preview CSS. Check rendered text and controls." }
      : check("Contrast check", ratio >= 4.5, "Preview body text " + ratio.toFixed(2) + ":1. Target 4.5:1 for normal text. Review other text and gradients separately."),
    links.length === 0
      ? { label: "Broken-link check", status: "not-applicable", detail: "No links in the preview." }
      : check("Broken-link check", !broken.length, broken.length
        ? "Missing or placeholder targets: " + broken.slice(0, 5).map((url) => url.slice(0, 100) || "(empty href)").join(", ") + "."
        : "In-page targets checked." + (hostedLinks ? " Verify " + hostedLinks + " page or external link(s) after hosting." : "")),
    forms.length === 0
      ? { label: "Form interaction check", status: "not-applicable", detail: "No forms in the preview." }
      : missingSubmit
        ? check("Form interaction check", false, missingSubmit + " form(s) lack an enabled submit control.")
        : { label: "Form interaction check", status: "review", detail: forms.length + " form(s) have submit controls and " + fields.filter((field) => attr(field, "required") !== undefined).length + " required field(s). Test valid and invalid input and real delivery before publishing." },
    check("Unverified claims", !claims.length, claims.length ? claims.length + " potential claim(s) need verification." : "No common unsupported claim patterns found in the preview."),
    check("Missing content", !missingContent.length, missingContent.length ? missingContent.length + " item(s) need attention." : "No missing tracked requirements or common placeholders detected.")
  ];
  const paths = site.files.map((file) => file.path.replace(/^\.\//, "").toLowerCase());
  const configFiles = paths.filter((file) => /^(vercel\.json|netlify\.toml)$/.test(file));
  const checklist: LaunchCheck[] = [
    check("Preview generated", Boolean(text && elements.some((node) => /^(main|section|h1)$/.test(node.tagName))), "Checks for visible page content."),
    { ...checks[0], label: "Mobile layout rules checked" },
    check("Components included in export", paths.some((file) => /(?:^|\/)components\/.+\.[jt]sx?$/.test(file)), "Checks the source package for component files."),
    { ...checks[4], label: "Form submission review" },
    check("README created", paths.includes("readme.md"), "Checks for README.md in the generated files."),
    {
      label: "Deployment configuration",
      status: configFiles.length || targets.length ? "pass" : "review",
      detail: [configFiles.length ? "Package: " + configFiles.join(", ") + "." : "", targets.length ? "Configured in SiteCraft: " + targets.join(", ") + "." : ""].filter(Boolean).join(" ") || "Set up a deployment target or upload the ZIP to your hosting provider."
    }
  ];
  const scored = [...checks, checklist[0], checklist[2], checklist[4]].filter((item) => item.status !== "not-applicable");
  const passed = scored.filter((item) => item.status === "pass").length;
  const score = Math.round(100 * (passed + coverage.covered) / (scored.length + coverage.total));
  return { score, coverage, requirements, checks, checklist, claims, missingContent };
}
