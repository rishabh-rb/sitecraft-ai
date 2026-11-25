import type { CodeBundle, ContentBundle, DesignSystem, WebsitePlan } from "./types.js";
import type { ImageAsset } from "./image-agent.js";
import { createFiles, renderHtml } from "./generator.js";

function cleanTitle(value: string): string {
  const matchNamed = value.match(/(?:called|named|brand|title)\s+([A-Za-z0-9\s_-]+?)(?:\s+(?:with|using|in|featuring|and|\.|$))/i);
  if (matchNamed && matchNamed[1]?.trim()) {
    return matchNamed[1].trim().split(" ").slice(0, 3).map((w) => (w ? w[0].toUpperCase() + w.slice(1) : "")).join(" ");
  }

  const words = value.replace(/\b(create|a|an|modern|responsive|editable|website|site|landing|page|for|using|with|dark|light|theme|blue|purple|accent|accents|colors|color|platform|application|app)\b/gi, " ")
    .replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!words) return "Creative Showcase";
  return words.split(" ")
    .slice(0, 3)
    .map((word) => (word ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word))
    .join(" ");
}

function hasAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

export function createLocalPlan(prompt: string): WebsitePlan {
  const lower = prompt.toLowerCase();

  const isPortfolio = lower.includes("portfolio") || lower.includes("engineer") || lower.includes("developer") || lower.includes("designer");
  const isRestaurant = lower.includes("restaurant") || lower.includes("cafe") || lower.includes("food") || lower.includes("dining");
  const isSaas = lower.includes("saas") || lower.includes("app") || lower.includes("software") || lower.includes("ai");
  const isAgency = lower.includes("agency") || lower.includes("studio") || lower.includes("digital");
  const isShop = lower.includes("shop") || lower.includes("store") || lower.includes("ecommerce") || lower.includes("e-commerce");
  const isDashboard = lower.includes("dashboard") || lower.includes("admin panel") || lower.includes("analytics");

  const type = isPortfolio ? "portfolio" : isRestaurant ? "restaurant" : isShop ? "ecommerce" : isDashboard ? "dashboard" : isSaas ? "saas" : isAgency ? "agency" : "business";

  // Palette extraction
  const isDark = lower.includes("dark") || (!lower.includes("light") && isPortfolio);
  const primaryHex = lower.includes("purple") || lower.includes("violet") ? "#8b5cf6" : lower.includes("blue") ? "#3b82f6" : lower.includes("green") ? "#10b981" : lower.includes("orange") ? "#f97316" : "#6366f1";
  const secondaryHex = lower.includes("purple") ? "#a855f7" : lower.includes("blue") ? "#60a5fa" : lower.includes("green") ? "#34d399" : "#38bdf8";

  const palette = isRestaurant
    ? {
        primary: lower.includes("green") ? "#2f6f57" : "#b45309",
        secondary: lower.includes("green") ? "#d4a72c" : "#d97706",
        background: isDark ? "#17120f" : "#fff8ed",
        foreground: isDark ? "#fff7ed" : "#2b2118"
      }
    : isShop
      ? {
          primary: primaryHex,
          secondary: secondaryHex,
          background: isDark ? "#111318" : "#faf7f2",
          foreground: isDark ? "#f8fafc" : "#24201c"
        }
      : isPortfolio
        ? {
            primary: primaryHex,
            secondary: secondaryHex,
            background: isDark ? "#0a0d14" : "#f4f7fb",
            foreground: isDark ? "#f8fafc" : "#172033"
          }
        : {
            primary: primaryHex,
            secondary: secondaryHex,
            background: isDark ? "#0a0d14" : "#f8fafc",
            foreground: isDark ? "#f8fafc" : "#0a0d14"
          };

  const wantsPricing = /\b(pricing|subscription plans|pricing tiers)\b/.test(lower) &&
    !/\b(?:no|without|skip|omit|exclude)\s+(?:any\s+)?pricing\b|\bpricing\s+(?:is\s+)?not requested\b/.test(lower) && !isRestaurant;
  const wantsTestimonials = /\b(?:testimonials?|customer reviews?|social proof)\b/.test(lower) &&
    !/\b(?:no|without|skip|omit|exclude)\s+(?:customer\s+)?(?:testimonials?|reviews?)\b/.test(lower);
  const wantsFaq = hasAny(lower, ["faq", "frequently asked", "questions", "help center"]);
  const nameTitle = cleanTitle(prompt);
  const siteName = isPortfolio
    ? (nameTitle.toLowerCase().includes("portfolio") ? nameTitle : `${nameTitle} Portfolio`)
    : nameTitle;

  const sections: string[] = isRestaurant
    ? ["navbar", "hero", "menu", "specials", "story", "location", "reservation", "footer"]
    : isShop
      ? ["navbar", "hero", "categories", "featured-products", "product-grid", "cart", "newsletter", "footer"]
      : isPortfolio
        ? ["navbar", "hero", "about", "selected-work", "skills", "experience", "contact", "footer"]
        : isDashboard
          ? ["sidebar", "topbar", "overview", "activity", "analytics", "settings"]
          : ["navbar", "hero", "features", "workflow", "faq", "contact", "footer"];

  const descriptions: Record<string, string> = {
    restaurant: "A welcoming seasonal restaurant experience with thoughtful dishes, warm hospitality, and an easy reservation journey.",
    portfolio: "A focused portfolio experience that presents selected work, skills, and a clear way to start a conversation.",
    ecommerce: "A considered storefront experience with curated products, clear discovery, and a confident path to purchase.",
    dashboard: "A focused workspace for understanding activity, performance, and the next action that matters.",
    saas: "A clear product story that explains the value, workflow, and next step for the people this product serves.",
    agency: "A confident studio experience that makes the work, approach, and partnership opportunity easy to understand.",
    business: "A focused business website that turns the brief into a clear, useful, and responsive customer journey."
  };
  const features = ["responsive-grid", "unsplash-imagery"];
  if (isRestaurant) features.push("menu-highlights", "reservation-form");
  if (isPortfolio) features.push("selected-work", "contact-form");
  if (isShop) features.push("product-grid", "newsletter");
  if (isDashboard) features.push("analytics", "activity-feed");
  if (!isRestaurant && !isDashboard && !features.includes("contact-form")) features.push("contact-form");
  if (wantsPricing) features.push("pricing");
  if (wantsTestimonials) features.push("social-proof");
  if (wantsFaq) features.push("faq-accordion");

  return {
    siteName,
    siteDescription: descriptions[type] || descriptions.business,
    pages: isDashboard
      ? [
          { name: "Overview", slug: "/", pageType: "landing", sections },
          { name: "Settings", slug: "/settings", pageType: "contact", sections: ["sidebar", "profile", "preferences"] }
        ]
      : [{ name: "Home", slug: "/", pageType: isShop ? "ecommerce" : isPortfolio ? "portfolio" : "landing", sections }],
    theme: isDark ? "Futuristic Dark Glassmorphism" : "Clean Modern Editorial",
    colorPalette: palette,
    fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
    features
  };
}

export function createLocalDesign(plan: WebsitePlan): DesignSystem {
  const componentBySection: Record<string, string> = {
    navbar: "Navbar",
    sidebar: "Sidebar",
    topbar: "Topbar",
    hero: "Hero",
    features: "Features",
    workflow: "Workflow",
    menu: "Menu",
    specials: "Specials",
    story: "Story",
    about: "About",
    location: "Location",
    reservation: "ReservationForm",
    contact: "ContactForm",
    pricing: "Pricing",
    testimonials: "Testimonials",
    reviews: "Reviews",
    faq: "FAQ",
    footer: "Footer"
  };
  const componentHierarchy = Array.from(new Set(
    plan.pages.flatMap((page) => page.sections).map((section) => componentBySection[section.toLowerCase()] || section.replace(/(^|-|\s)(\w)/g, (_, _separator, letter) => letter.toUpperCase()))
  ));
  return {
    layout: `Responsive modular layout with a focused information hierarchy for ${plan.siteName}, touch-friendly controls, and clear mobile stacking rules.`,
    componentHierarchy: componentHierarchy.length ? componentHierarchy : ["Navbar", "Hero", "Footer"],
    tokens: {
      radius: "16px",
      spacing: "1.5rem",
      shadow: "0 20px 50px rgba(0,0,0,.3)"
    },
    responsiveRules: [
      "Full mobile responsiveness down to 360px viewport width",
      "Flexible grid columns auto-adjusting for desktop (3 cols), tablet (2 cols), and mobile (1 col)",
      "Accessible contrast ratios compliant with WCAG 2.1 AA guidelines"
    ]
  };
}

export function createLocalContent(plan: WebsitePlan, prompt: string): ContentBundle {
  const lower = prompt.toLowerCase();
  const isPortfolio = plan.siteName.toLowerCase().includes("portfolio") || lower.includes("portfolio") || lower.includes("engineer");
  const isRestaurant = lower.includes("restaurant") || lower.includes("cafe") || lower.includes("dining");
  const isShop = lower.includes("shop") || lower.includes("store") || lower.includes("ecommerce");

  const requestedSections = new Set(plan.pages.flatMap((page) => page.sections.map((section) => section.toLowerCase())));
  const wantsFaq = hasAny(lower, ["faq", "frequently asked", "questions", "help center"]);
  const sections = isPortfolio
    ? [
        { title: "Selected work", body: "A concise view of projects that show how ideas became useful, shipped experiences.", items: ["Product thinking", "Crafted interfaces", "Measured outcomes"] },
        { title: "Skills and approach", body: "A practical combination of product design, engineering, and clear communication.", items: ["Research-led decisions", "Accessible responsive UI", "Reliable delivery"] },
        { title: "Experience that compounds", body: "From first sketch to production handoff, every stage stays connected to the real goal.", items: ["Strategy", "Design systems", "Implementation"] }
      ]
    : isRestaurant
      ? [
          { title: "Seasonal menu", body: "Our menu follows the market, bringing local ingredients and thoughtful technique to every plate.", items: ["Fresh seasonal produce", "Chef-led tasting menus", "Vegetarian-friendly plates"] },
          { title: "The room and the ritual", body: "A warm dining room for slow evenings, shared plates, and the kind of conversation that keeps going.", items: ["Warm hospitality", "Curated wine list", "Private dining"] },
          { title: "Plan your visit", body: "Explore dining options before your visit.", items: ["Menu highlights", "Reservation inquiries", "Dining information"] }
        ]
      : isShop
        ? [
            { title: "Curated collection", body: "A considered range of useful, beautiful pieces selected for everyday living.", items: ["Clear product stories", "Small-batch makers", "Thoughtful materials"] },
            { title: "Made with intention", body: "Every item is chosen for how it feels, functions, and fits into a more considered routine.", items: ["Transparent sourcing", "Long-lasting design", "Simple care guidance"] },
            { title: "Shopping information", body: "Add your store’s delivery and returns details before launch.", items: ["Product details", "Delivery information", "Store policies"] }
          ]
        : [
            { title: requestedSections.has("workflow") ? "A clearer workflow" : "Built around your needs", body: `A focused journey for ${prompt.replace(/\s+/g, " ").trim().slice(0, 110)}.`, items: ["Clear next steps", "Responsive on every device", "Thoughtful interactions"] },
            { title: requestedSections.has("features") ? "The important details" : "Useful by default", body: "A small set of carefully structured sections keeps the experience easy to scan and easy to act on.", items: ["Purposeful hierarchy", "Accessible contrast", "Reusable components"] },
            { title: "Ready to grow", body: "The foundation stays modular so new content and features can be added without losing the original shape.", items: ["Design tokens", "Component boundaries", "Exportable source"] }
          ];

  return {
    heroTitle: isPortfolio
      ? "Full-Stack Engineer & AI Systems Architect"
      : isRestaurant
        ? "A table worth remembering"
        : isShop
          ? "Thoughtfully chosen. Made to last."
          : plan.siteName,
    heroSubtitle: isPortfolio
      ? "Crafting high-performance cloud applications, scalable architectures, and beautiful interactive experiences with modern React, TypeScript, and AI."
      : isRestaurant
        ? "Discover seasonal plates, warm hospitality, and a dining experience designed around the people at your table."
        : isShop
        ? "Explore a considered collection of products selected for everyday living."
          : `A focused experience for ${prompt.replace(/\s+/g, " ").trim().slice(0, 120)}.`,
    primaryCta: isPortfolio ? "Explore Projects" : isRestaurant ? "View the Menu" : isShop ? "Shop the Collection" : "Explore the Experience",
    secondaryCta: isRestaurant ? "Reserve a Table" : isShop ? "Learn Our Story" : "See How It Works",
    sections,
    testimonials: [],
    faq: wantsFaq ? [
      { question: "How can I customize the generated website?", answer: "Use conversational edits in the builder, inspect the generated files, or download the project and continue locally." },
      { question: "Does the generated website work on mobile?", answer: "Yes. The generator includes responsive layout rules and the builder provides desktop, tablet, and mobile preview modes." },
      { question: "Can I export the source code?", answer: "Yes. Download the ZIP package after reviewing the preview and generated files." }
    ] : [],
    seo: {
      title: `${plan.siteName} — Built with SiteCraft AI`,
      description: plan.siteDescription
    }
  };
}

export function createLocalCode(plan: WebsitePlan, design: DesignSystem, content: ContentBundle, assets: ImageAsset[] = []): CodeBundle {
  const html = renderHtml(plan, design, content, assets);
  return {
    html,
    files: createFiles(plan, design, content, html, assets),
    assets: assets.length > 0 ? assets.map((a) => ({ kind: a.kind, description: a.description, url: a.url })) : [
      { kind: "visual", description: "Dynamic CSS gradients and modern card layouts matching theme tokens." }
    ]
  };
}
