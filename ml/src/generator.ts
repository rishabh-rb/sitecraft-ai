import type { ContentBundle, DesignSystem, GeneratedFile, WebsitePlan } from "./types.js";
import type { ImageAsset } from "./image-agent.js";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character);
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  return [Number.parseInt(value.slice(0, 2), 16), Number.parseInt(value.slice(2, 4), 16), Number.parseInt(value.slice(4, 6), 16)];
}

function relativeLuminance(hex: string): number {
  return hexToRgb(hex).map((channel) => {
    const normalized = channel / 255;
    return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  }).reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index], 0);
}

export function renderHtml(plan: WebsitePlan, design: DesignSystem, content: ContentBundle, assets: ImageAsset[] = []): string {
  const { primary, secondary, background } = plan.colorPalette;
  const isLightTheme = relativeLuminance(background) > 0.45;
  const foreground = isLightTheme
    ? relativeLuminance(plan.colorPalette.foreground) < 0.45 ? plan.colorPalette.foreground : "#1f2937"
    : relativeLuminance(plan.colorPalette.foreground) > 0.45 ? plan.colorPalette.foreground : "#f8fafc";
  const requestedSections = new Set(plan.pages.flatMap((page) => page.sections.map((section) => section.toLowerCase())));
  const showPricing = requestedSections.has("pricing") || plan.features.some((feature) => /pricing|subscription-plans/i.test(feature));
  const showTestimonials = requestedSections.has("testimonials") || requestedSections.has("reviews") || plan.features.some((feature) => /review|testimonial|social[- ]proof/i.test(feature));
  const showFaq = content.faq.length > 0 && (requestedSections.has("faq") || plan.features.some((feature) => /faq|question|help/i.test(feature)));
  const showAbout = requestedSections.has("about") || requestedSections.has("story") || requestedSections.has("location");
  const sectionLabel = requestedSections.has("menu") ? "OUR MENU" : requestedSections.has("selected-work") ? "SELECTED WORK" : requestedSections.has("products") || requestedSections.has("product-grid") ? "COLLECTION" : "FEATURES";
  const sectionHeading = requestedSections.has("menu") ? "Made for the table" : requestedSections.has("selected-work") ? "Work with intention" : requestedSections.has("products") || requestedSections.has("product-grid") ? "Explore the collection" : content.sections[0]?.title || "Built around your needs";
  const aboutHeading = requestedSections.has("story") ? "Our story, served with care" : requestedSections.has("about") ? "A closer look at the work" : `Why ${plan.siteName}`;
  const navItems = [
    { href: "#features", label: sectionLabel.replace("OUR ", "").replace("SELECTED ", "") },
    ...(requestedSections.has("about") || requestedSections.has("story") ? [{ href: "#about", label: requestedSections.has("story") ? "Our Story" : "About" }] : []),
    ...(showPricing ? [{ href: "#pricing", label: "Pricing" }] : []),
    ...(showTestimonials ? [{ href: "#testimonials", label: "Reviews" }] : []),
    ...(showFaq ? [{ href: "#faq", label: "FAQ" }] : [])
  ];
  const navMarkup = navItems.map((item) => `<a href="${item.href}" class="hover:text-[var(--primary)] transition-colors duration-150">${escapeHtml(item.label)}</a>`).join("");
  const mobileNavMarkup = navItems.map((item) => `<a href="${item.href}" class="block py-2 text-sm font-semibold text-slate-300 hover:text-[var(--primary)]">${escapeHtml(item.label)}</a>`).join("");
  
  const heroImage = assets.find((a) => a.kind === "hero")?.url || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80";
  const featureImg1 = assets.find((a) => a.kind === "feature-1")?.url || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80";
  const featureImg2 = assets.find((a) => a.kind === "feature-2")?.url || "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80";
  const featureImg3 = assets.find((a) => a.kind === "feature-3")?.url || "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=800&q=80";
  const aboutImage = assets.find((a) => a.kind === "about")?.url || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80";

  const featureImages = [featureImg1, featureImg2, featureImg3];

  // Dynamic feature cards
  const featuresMarkup = content.sections.map((section, idx) => {
    const cardImg = featureImages[idx % featureImages.length];
    const itemsList = section.items?.map((item) => `
      <li class="flex items-center gap-2 text-sm text-slate-300">
        <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
          <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
        </svg>
        <span>${escapeHtml(item)}</span>
      </li>
    `).join("") ?? "";

    return `
      <div class="group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl hover:shadow-indigo-500/10 flex flex-col justify-between overflow-hidden">
        <div class="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-all duration-500"></div>
        <div>
          <div class="mb-5 overflow-hidden rounded-xl border border-white/10 aspect-video relative">
            <img src="${escapeHtml(cardImg)}" alt="${escapeHtml(section.title)}" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
            <span class="absolute bottom-3 left-3 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/10">0${idx + 1} • Feature</span>
          </div>
          <h3 class="text-xl font-bold tracking-tight text-white mb-2">${escapeHtml(section.title)}</h3>
          <p class="text-sm leading-relaxed text-slate-400 mb-4">${escapeHtml(section.body)}</p>
          ${itemsList ? `<ul class="space-y-2 pt-2 border-t border-white/5">${itemsList}</ul>` : ""}
        </div>
      </div>
    `;
  }).join("");

  const testimonialsMarkup = content.testimonials.map((item) => {
    return `
      <div class="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all duration-300">
        <div>
          <p class="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 italic">“${escapeHtml(item.quote)}”</p>
        </div>
        <div class="flex items-center gap-3 pt-4 border-t border-white/10">
          <div>
            <h4 class="text-sm font-bold text-white">${escapeHtml(item.name)}</h4>
            <p class="text-xs text-slate-400">${escapeHtml(item.role)}</p>
          </div>
        </div>
      </div>
    `;
  }).join("");

  // FAQ Accordion
  const faqMarkup = content.faq.map((item, idx) => `
    <details class="group rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-all duration-200 open:bg-white/[0.06] open:border-indigo-500/30">
      <summary class="flex cursor-pointer items-center justify-between font-semibold text-white text-base">
        <span>${escapeHtml(item.question)}</span>
        <span class="ml-4 flex-shrink-0 text-slate-400 transition-transform duration-300 group-open:rotate-180">
          <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </summary>
      <p class="mt-3 text-sm leading-relaxed text-slate-300 pr-4">${escapeHtml(item.answer)}</p>
    </details>
  `).join("");

  return `<!doctype html>
<html lang="en" class="${isLightTheme ? "theme-light " : ""}scroll-smooth">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${escapeHtml(content.seo.description)}">
  <title>${escapeHtml(content.seo.title)}</title>
  
  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
          },
          colors: {
            brand: {
              primary: '${primary}',
              secondary: '${secondary}',
              bg: '${background}',
              fg: '${foreground}',
            }
          }
        }
      }
    }
  </script>

  <style>
    :root {
      --primary: ${primary};
      --secondary: ${secondary};
      --bg: ${background};
      --fg: ${foreground};
      --surface: ${isLightTheme ? "color-mix(in srgb, var(--bg) 88%, var(--fg))" : "color-mix(in srgb, var(--bg) 82%, white)"};
      --surface-raised: ${isLightTheme ? "color-mix(in srgb, var(--bg) 96%, var(--fg))" : "color-mix(in srgb, var(--bg) 72%, white)"};
      --surface-muted: ${isLightTheme ? "color-mix(in srgb, var(--bg) 94%, var(--fg))" : "color-mix(in srgb, var(--bg) 90%, white)"};
      --line: ${isLightTheme ? "color-mix(in srgb, var(--fg) 14%, transparent)" : "color-mix(in srgb, white 14%, transparent)"};
      --on-primary: ${relativeLuminance(primary) > 0.45 ? "#111827" : "#ffffff"};
    }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: 'Plus Jakarta Sans', Inter, system-ui, sans-serif;
      overflow-x: hidden;
    }
    .glow-bg {
      background: radial-gradient(circle at 50% 0%, color-mix(in srgb, var(--primary) 25%, transparent) 0%, transparent 65%);
    }
    .text-gradient {
      background: linear-gradient(135deg, #ffffff 0%, color-mix(in srgb, var(--primary) 90%, white) 50%, color-mix(in srgb, var(--secondary) 90%, white) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .glass-nav {
      background: color-mix(in srgb, var(--bg) 75%, transparent);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
    }
    .theme-light .text-white { color: var(--fg) !important; }
    .theme-light .text-slate-200, .theme-light .text-slate-300, .theme-light .text-slate-400 { color: color-mix(in srgb, var(--fg) 68%, transparent) !important; }
    .theme-light .bg-slate-950\/80, .theme-light .bg-slate-950\/95 { background: color-mix(in srgb, var(--bg) 92%, var(--fg)) !important; }
    .theme-light .border-white\/10, .theme-light .border-white\/15, .theme-light .border-white\/20 { border-color: color-mix(in srgb, var(--fg) 14%, transparent) !important; }
    .theme-light .text-gradient { background: linear-gradient(135deg, var(--fg), var(--primary)); -webkit-background-clip: text; background-clip: text; }
    .bg-slate-950, .bg-slate-950\/80, .bg-slate-950\/95 { background-color: var(--surface) !important; }
    .bg-white\/\[0\.01\], .bg-white\/\[0\.03\], .bg-white\/\[0\.04\], .bg-white\/\[0\.05\], .bg-white\/\[0\.08\] { background-color: var(--surface-muted) !important; }
    .border-white\/5, .border-white\/10, .border-white\/15, .border-white\/20 { border-color: var(--line) !important; }
    .text-white { color: var(--fg); }
    .bg-gradient-to-r.from-\[var\(--primary\)\] { color: var(--on-primary); }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased selection:bg-indigo-500 selection:text-white">

  <!-- Sticky Navbar -->
  <header class="sticky top-0 z-50 glass-nav border-b border-white/10 transition-all duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
      <a href="#top" class="flex items-center gap-3 group">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform duration-200">
          ${escapeHtml(plan.siteName.charAt(0).toUpperCase())}
        </div>
        <span class="text-xl font-extrabold tracking-tight text-white">${escapeHtml(plan.siteName)}</span>
      </a>

      <!-- Desktop Navigation -->
      <nav class="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
        ${navMarkup}
      </nav>

      <!-- Action Button -->
      <div class="hidden md:flex items-center gap-4">
        <a href="#contact" class="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-95 hover:shadow-lg hover:shadow-indigo-500/30 transition-all duration-200">
          ${escapeHtml(content.primaryCta)}
        </a>
      </div>

      <!-- Mobile Menu Button -->
      <button id="mobile-menu-btn" class="md:hidden text-slate-300 hover:text-white focus:outline-none p-2" aria-label="Toggle navigation">
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </div>

    <!-- Mobile Dropdown -->
    <div id="mobile-menu" class="hidden md:hidden px-4 pt-2 pb-6 space-y-3 bg-slate-950/95 border-b border-white/10">
      ${mobileNavMarkup}
      <a href="#contact" class="block text-center py-2.5 mt-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]">${escapeHtml(content.primaryCta)}</a>
    </div>
  </header>

  <main class="flex-grow">
    <!-- Hero Section -->
    <section id="top" class="relative pt-20 pb-28 sm:pt-28 sm:pb-36 glow-bg overflow-hidden">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <!-- Announcement Pill -->
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-md mb-8 hover:border-white/30 transition-colors">
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span class="text-xs font-semibold text-slate-200">${escapeHtml(plan.theme)}</span>
        </div>

        <!-- Headline -->
        <h1 class="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6">
          <span class="text-gradient">${escapeHtml(content.heroTitle)}</span>
        </h1>

        <!-- Subtitle -->
        <p class="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10 font-normal">
          ${escapeHtml(content.heroSubtitle)}
        </p>

        <!-- CTA Buttons -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <a href="#contact" class="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:shadow-xl hover:shadow-indigo-500/25 transition-all duration-200 hover:-translate-y-0.5">
            <span>${escapeHtml(content.primaryCta)}</span>
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
          </a>
          <a href="#features" class="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-full text-base font-bold text-slate-200 border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] hover:text-white transition-all duration-200 backdrop-blur-md">
            ${escapeHtml(content.secondaryCta)}
          </a>
        </div>

        <p class="mb-12 text-xs font-medium text-slate-400">AI-generated draft content — verify before publishing.</p>

        <!-- Hero Showcase Visual Frame -->
        <div class="relative mx-auto max-w-5xl rounded-2xl border border-white/20 bg-slate-950/80 p-2 sm:p-3 shadow-2xl shadow-indigo-500/10 backdrop-blur-2xl">
          <div class="flex items-center gap-2 px-3 py-2 border-b border-white/10 mb-2">
            <div class="flex gap-1.5">
              <div class="w-3 h-3 rounded-full bg-rose-500/80"></div>
              <div class="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div class="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
            <div class="mx-auto rounded-md bg-white/5 px-6 py-1 text-xs text-slate-400 font-mono">${escapeHtml(plan.siteName.toLowerCase().replace(/[^a-z0-9]/g, ""))}.app</div>
          </div>
          <div class="overflow-hidden rounded-xl aspect-[16/9] relative">
            <img src="${escapeHtml(heroImage)}" alt="${escapeHtml(plan.siteName)} Hero Showcase" class="w-full h-full object-cover" loading="eager" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Features Section -->
    <section id="features" class="py-24 sm:py-32 border-t border-white/10 relative">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <span class="text-xs font-bold uppercase tracking-widest text-[var(--primary)] mb-3 block">${sectionLabel}</span>
          <h2 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">${escapeHtml(sectionHeading)}</h2>
          <p class="text-base sm:text-lg text-slate-400 leading-relaxed">${escapeHtml(plan.siteDescription)}</p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          ${featuresMarkup}
        </div>
      </div>
    </section>

    <!-- About / Spotlight Section -->
    <section id="about" class="${showAbout ? "" : "hidden "}py-24 sm:py-32 border-t border-white/10 bg-white/[0.01]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <div>
            <span class="text-xs font-bold uppercase tracking-widest text-[var(--secondary)] mb-3 block">${requestedSections.has("story") ? "OUR STORY" : "ABOUT"}</span>
            <h2 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-6">${escapeHtml(aboutHeading)}</h2>
            <p class="text-slate-300 text-base sm:text-lg leading-relaxed mb-6">${escapeHtml(content.sections[1]?.body || plan.siteDescription)}</p>
            <div class="grid grid-cols-2 gap-6 pt-4 border-t border-white/10">
              <div>
                <p class="text-3xl font-extrabold text-white mb-1">360°</p>
                <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Responsive thinking</p>
              </div>
              <div>
                <p class="text-3xl font-extrabold text-white mb-1">1 brief</p>
                <p class="text-xs text-slate-400 uppercase tracking-wider font-semibold">Clear starting point</p>
              </div>
            </div>
          </div>
          <div class="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl">
            <img src="${escapeHtml(aboutImage)}" alt="About ${escapeHtml(plan.siteName)}" class="w-full h-80 sm:h-96 object-cover" loading="lazy" />
            <div class="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Interactive Pricing Section -->
    <section id="pricing" ${showPricing ? "" : "hidden"} class="py-24 sm:py-32 border-t border-white/10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-14">
          <span class="text-xs font-bold uppercase tracking-widest text-[var(--primary)] mb-3 block">TRANSPARENT PRICING</span>
          <h2 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">Simple, Scalable Plans</h2>
          <p class="text-base sm:text-lg text-slate-400">Example pricing and features. Replace these with your actual plans before publishing.</p>

          <!-- Monthly/Annual Toggle Switch -->
          <div class="inline-flex items-center gap-3 mt-8 p-1.5 rounded-full border border-white/10 bg-white/[0.04]">
            <button id="btn-monthly" class="px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 bg-[var(--primary)] text-white">Monthly</button>
            <button id="btn-annual" class="px-5 py-2 rounded-full text-xs font-bold text-slate-400 hover:text-white transition-all duration-200">
              Annual <span class="ml-1 text-emerald-400 font-extrabold">Save 20%</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          <!-- Starter Tier -->
          <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all duration-300">
            <div>
              <h3 class="text-lg font-bold text-white mb-2">Starter</h3>
              <p class="text-xs text-slate-400 mb-6">Perfect for early adopters and individual creators.</p>
              <div class="flex items-baseline gap-1 mb-6">
                <span class="text-4xl font-extrabold text-white price-starter">$29</span>
                <span class="text-xs text-slate-400 period-text">/month</span>
              </div>
              <ul class="space-y-3 text-xs sm:text-sm text-slate-300 mb-8">
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Core feature access</li>
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> 5 active projects</li>
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Community support</li>
              </ul>
            </div>
            <a href="#contact" class="w-full text-center py-3 rounded-xl text-xs font-bold text-slate-200 border border-white/20 bg-white/5 hover:bg-white/10 transition-colors">Get Started</a>
          </div>

          <!-- Pro Tier (Popular) -->
          <div class="relative rounded-2xl border-2 border-[var(--primary)] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-2xl flex flex-col justify-between shadow-2xl shadow-indigo-500/20 transform md:-translate-y-2">
            <div>
              <h3 class="text-lg font-bold text-white mb-2">Professional</h3>
              <p class="text-xs text-slate-400 mb-6">Designed for growing teams needing full power.</p>
              <div class="flex items-baseline gap-1 mb-6">
                <span class="text-4xl font-extrabold text-white price-pro">$79</span>
                <span class="text-xs text-slate-400 period-text">/month</span>
              </div>
              <ul class="space-y-3 text-xs sm:text-sm text-slate-300 mb-8">
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Everything in Starter</li>
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Unlimited projects & assets</li>
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Priority 24/7 support</li>
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Advanced analytics & telemetry</li>
              </ul>
            </div>
            <a href="#contact" class="w-full text-center py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-95 shadow-lg shadow-indigo-500/25 transition-all">Claim Pro Access</a>
          </div>

          <!-- Enterprise Tier -->
          <div class="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all duration-300">
            <div>
              <h3 class="text-lg font-bold text-white mb-2">Enterprise</h3>
              <p class="text-xs text-slate-400 mb-6">Custom architecture and dedicated support.</p>
              <div class="flex items-baseline gap-1 mb-6">
                <span class="text-4xl font-extrabold text-white price-enterprise">$199</span>
                <span class="text-xs text-slate-400 period-text">/month</span>
              </div>
              <ul class="space-y-3 text-xs sm:text-sm text-slate-300 mb-8">
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Dedicated account engineer</li>
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> Custom SLAs & security review</li>
                <li class="flex items-center gap-2"><svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/></svg> White-label capabilities</li>
              </ul>
            </div>
            <a href="#contact" class="w-full text-center py-3 rounded-xl text-xs font-bold text-slate-200 border border-white/20 bg-white/5 hover:bg-white/10 transition-colors">Contact Enterprise</a>
          </div>
        </div>
      </div>
    </section>

    <!-- Testimonials Section -->
    <section id="testimonials" ${showTestimonials ? "" : "hidden"} class="py-24 sm:py-32 border-t border-white/10 bg-white/[0.01]">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center max-w-3xl mx-auto mb-16">
          <span class="text-xs font-bold uppercase tracking-widest text-[var(--secondary)] mb-3 block">TESTIMONIALS</span>
          <h2 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">Customer reviews</h2>
          ${content.testimonials.length ? "" : '<p class="text-base text-slate-400">Add verified customer reviews before publishing.</p>'}
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
          ${testimonialsMarkup}
        </div>
      </div>
    </section>

    <!-- FAQ Section -->
    <section id="faq" class="${showFaq ? "" : "hidden " }py-24 sm:py-32 border-t border-white/10">
      <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="text-center mb-16">
          <span class="text-xs font-bold uppercase tracking-widest text-[var(--primary)] mb-3 block">FAQ</span>
          <h2 class="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">Frequently Asked Questions</h2>
          <p class="text-base text-slate-400">Everything you need to know about ${escapeHtml(plan.siteName)}.</p>
        </div>

        <div class="space-y-4">
          ${faqMarkup}
        </div>
      </div>
    </section>

    <!-- Contact / Lead Form Section -->
    <section id="contact" class="py-24 sm:py-32 border-t border-white/10 relative glow-bg">
      <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span class="text-xs font-bold uppercase tracking-widest text-[var(--secondary)] mb-3 block">GET IN TOUCH</span>
        <h2 class="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">${requestedSections.has("reservation") ? "Reserve your place at the table." : requestedSections.has("contact") ? "Let’s start a conversation." : `Take the next step with ${escapeHtml(plan.siteName)}.`}</h2>
        <p class="text-base sm:text-lg text-slate-300 mb-10 leading-relaxed">Preview form. Connect a submission endpoint to receive inquiries.</p>

        <form id="contact-form" class="rounded-2xl border border-white/15 bg-slate-950/80 p-6 sm:p-10 backdrop-blur-2xl text-left shadow-2xl">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div>
              <label for="contact-name" class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Full Name</label>
              <input type="text" id="contact-name" required placeholder="Alex Morgan" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all" />
            </div>
            <div>
              <label for="contact-email" class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Email Address</label>
              <input type="email" id="contact-email" required placeholder="alex@company.com" class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all" />
            </div>
          </div>
          ${requestedSections.has("reservation") ? '<div class="mb-6 grid gap-4 sm:grid-cols-2"><label>Visit date<input name="visit-date" type="date" required class="block w-full rounded-lg p-2 text-slate-900" /></label><label>Number of guests<input name="guests" type="number" min="1" required class="block w-full rounded-lg p-2 text-slate-900" /></label></div>' : ""}
          <div class="mb-6">
            <label for="contact-message" class="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Message or Requirement</label>
            <textarea id="contact-message" rows="4" required placeholder="Tell us how we can assist your project..." class="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[var(--primary)] focus:ring-1 focus:ring-[var(--primary)] transition-all"></textarea>
          </div>
          <button type="submit" class="w-full py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-95 shadow-lg shadow-indigo-500/25 transition-all">
            ${escapeHtml(content.primaryCta)}
          </button>
        </form>

        <div id="form-toast" role="status" class="hidden mt-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm font-semibold">
          Preview submission complete. No message was sent.
        </div>
      </div>
    </section>
  </main>

  <!-- Footer -->
  <footer class="border-t border-white/10 py-12 bg-slate-950 text-slate-400 text-xs sm:text-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center font-bold text-white text-xs">
          ${escapeHtml(plan.siteName.charAt(0).toUpperCase())}
        </div>
        <span class="font-bold text-white">${escapeHtml(plan.siteName)}</span>
      </div>
      <div>
        © ${new Date().getFullYear()} ${escapeHtml(plan.siteName)}. Autonomous Generation by SiteCraft AI.
      </div>
      <div class="flex items-center gap-6">
        <a href="#top" class="hover:text-white transition-colors">Back to Top ↑</a>
      </div>
    </div>
  </footer>

  <!-- Interactivity Scripts -->
  <script>
    // Mobile Navigation Toggle
    const mobileBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileBtn && mobileMenu) {
      mobileBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
    }

    // Pricing Billing Toggle
    const btnMonthly = document.getElementById('btn-monthly');
    const btnAnnual = document.getElementById('btn-annual');
    const priceStarter = document.querySelector('.price-starter');
    const pricePro = document.querySelector('.price-pro');
    const priceEnterprise = document.querySelector('.price-enterprise');
    const periodTexts = document.querySelectorAll('.period-text');

    if (btnMonthly && btnAnnual) {
      btnMonthly.addEventListener('click', () => {
        btnMonthly.className = "px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 bg-[var(--primary)] text-white";
        btnAnnual.className = "px-5 py-2 rounded-full text-xs font-bold text-slate-400 hover:text-white transition-all duration-200";
        if (priceStarter) priceStarter.textContent = "$29";
        if (pricePro) pricePro.textContent = "$79";
        if (priceEnterprise) priceEnterprise.textContent = "$199";
        periodTexts.forEach(p => p.textContent = "/month");
      });

      btnAnnual.addEventListener('click', () => {
        btnAnnual.className = "px-5 py-2 rounded-full text-xs font-bold transition-all duration-200 bg-[var(--primary)] text-white";
        btnMonthly.className = "px-5 py-2 rounded-full text-xs font-bold text-slate-400 hover:text-white transition-all duration-200";
        if (priceStarter) priceStarter.textContent = "$23";
        if (pricePro) pricePro.textContent = "$63";
        if (priceEnterprise) priceEnterprise.textContent = "$159";
        periodTexts.forEach(p => p.textContent = "/month (billed annually)");
      });
    }

    // Contact Form Submission
    const contactForm = document.getElementById('contact-form');
    const formToast = document.getElementById('form-toast');
    if (contactForm && formToast) {
      contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        contactForm.reset();
        formToast.classList.remove('hidden');
        setTimeout(() => {
          formToast.classList.add('hidden');
        }, 5000);
      });
    }
  </script>
</body>
</html>`;
}

export function createFiles(plan: WebsitePlan, design: DesignSystem, content: ContentBundle, html: string, assets: ImageAsset[] = []): GeneratedFile[] {
  const requestedSections = new Set(plan.pages.flatMap((page) => page.sections.map((section) => section.toLowerCase())));
  const showPricing = requestedSections.has("pricing") || plan.features.some((feature) => /pricing|subscription-plans/i.test(feature));
  const showTestimonials = requestedSections.has("testimonials") || requestedSections.has("reviews") || plan.features.some((feature) => /review|testimonial|social[- ]proof/i.test(feature));
  const showFaq = content.faq.length > 0 && (requestedSections.has("faq") || plan.features.some((feature) => /faq|question|help/i.test(feature)));
  const showAbout = requestedSections.has("about") || requestedSections.has("story") || requestedSections.has("location");
  const exportComponentNames = ["Navbar", "Hero", "Features", ...(showAbout ? ["About"] : []), ...(showPricing ? ["Pricing"] : []), ...(showTestimonials ? ["Testimonials"] : []), ...(showFaq ? ["FAQ"] : []), ...(requestedSections.has("contact") || requestedSections.has("reservation") ? ["ContactForm"] : []), "Footer"];
  const navLinks = [
    `<a href="#features" className="hover:text-white transition-colors">Features</a>`,
    ...(showAbout ? [`<a href="#about" className="hover:text-white transition-colors">${requestedSections.has("story") ? "Our Story" : "About"}</a>`] : []),
    ...(showPricing ? [`<a href="#pricing" className="hover:text-white transition-colors">Pricing</a>`] : []),
    ...(showTestimonials ? [`<a href="#testimonials" className="hover:text-white transition-colors">Reviews</a>`] : []),
    ...(showFaq ? [`<a href="#faq" className="hover:text-white transition-colors">FAQ</a>`] : [])
  ].join("\n          ");
  const heroImage = assets.find((a) => a.kind === "hero")?.url || "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80";
  const featureImg1 = assets.find((a) => a.kind === "feature-1")?.url || "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80";
  const featureImg2 = assets.find((a) => a.kind === "feature-2")?.url || "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80";
  const featureImg3 = assets.find((a) => a.kind === "feature-3")?.url || "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=800&q=80";
  const aboutImage = assets.find((a) => a.kind === "about")?.url || "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80";


  const navbarComponent = `import React, { useState } from "react";

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-950/80 border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        <a href="#top" className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center font-bold text-white shadow-lg">
            ${plan.siteName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xl font-extrabold tracking-tight text-white">${plan.siteName}</span>
        </a>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-300">
          ${navLinks}
        </nav>

        <div className="hidden md:flex items-center gap-4">
          <a
            href="#contact"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-full text-sm font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-95 shadow-lg shadow-indigo-500/20 transition-all"
          >
            ${content.primaryCta}
          </a>
        </div>

        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden text-slate-300 hover:text-white p-2"
          aria-label="Toggle Navigation"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
          </svg>
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden px-4 pt-2 pb-6 space-y-3 bg-slate-950 border-b border-white/10">
          ${navLinks.replaceAll('className="hover:text-white transition-colors"', 'onClick={() => setMobileOpen(false)} className="block py-2 text-sm font-semibold text-slate-300"')}
          <a href="#contact" onClick={() => setMobileOpen(false)} className="block text-center py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)]">
            ${content.primaryCta}
          </a>
        </div>
      )}
    </header>
  );
}`;

  const heroComponent = `import React from "react";

export function Hero() {
  return (
    <section id="top" className="relative pt-20 pb-28 sm:pt-28 sm:pb-36 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-md mb-8">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-semibold text-slate-200">${plan.theme}</span>
        </div>

        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight max-w-5xl mx-auto leading-[1.1] mb-6">
          <span className="bg-gradient-to-r from-white via-slate-100 to-indigo-200 bg-clip-text text-transparent">
            ${content.heroTitle}
          </span>
        </h1>

        <p className="text-lg sm:text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed mb-10">
          ${content.heroSubtitle}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
          <a
            href="#contact"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-8 py-4 rounded-full text-base font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:shadow-xl hover:shadow-indigo-500/25 transition-all"
          >
            <span>${content.primaryCta}</span>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </a>
          <a
            href="#features"
            className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-4 rounded-full text-base font-bold text-slate-200 border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] backdrop-blur-md transition-all"
          >
            ${content.secondaryCta}
          </a>
        </div>

        <p className="mb-12 text-xs font-medium text-slate-400">AI-generated draft content — verify before publishing.</p>

        {/* Showcase Frame with Hero Image */}
        <div className="relative mx-auto max-w-5xl rounded-2xl border border-white/20 bg-slate-950/80 p-2 sm:p-3 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10 mb-2">
            <div className="flex gap-1.5">
              <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
              <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
            </div>
            <div className="mx-auto rounded-md bg-white/5 px-6 py-1 text-xs text-slate-400 font-mono">${plan.siteName.toLowerCase().replace(/[^a-z0-9]/g, "")}.app</div>
          </div>
          <div className="overflow-hidden rounded-xl aspect-[16/9] relative">
            <img src="${heroImage}" alt="${plan.siteName} Hero" className="w-full h-full object-cover" loading="eager" />
          </div>
        </div>
      </div>
    </section>
  );
}`;

  const featuresComponent = `import React from "react";

const sections = ${JSON.stringify(content.sections, null, 2)};
const featureImages = [
  "${featureImg1}",
  "${featureImg2}",
  "${featureImg3}"
];

export function Features() {
  return (
    <section id="features" className="py-24 sm:py-32 border-t border-white/10 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary)] mb-3 block">CORE CAPABILITIES</span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">Engineered for Maximum Impact</h2>
          <p className="text-base sm:text-lg text-slate-400">Discover how our features elevate your workflow to state-of-the-art standards.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {sections.map((section, idx) => (
            <div
              key={idx}
              className="group relative rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 sm:p-8 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-2xl flex flex-col justify-between overflow-hidden"
            >
              <div>
                <div className="mb-5 overflow-hidden rounded-xl border border-white/10 aspect-video relative">
                  <img src={featureImages[idx % featureImages.length]} alt={section.title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" />
                  <span className="absolute bottom-3 left-3 rounded-full bg-slate-900/90 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/10">0{idx + 1} • Feature</span>
                </div>
                <h3 className="text-xl font-bold tracking-tight text-white mb-2">{section.title}</h3>
                <p className="text-sm leading-relaxed text-slate-400 mb-4">{section.body}</p>
                {section.items && (
                  <ul className="space-y-2 pt-2 border-t border-white/5">
                    {section.items.map((item, itemIdx) => (
                      <li key={itemIdx} className="flex items-center gap-2 text-sm text-slate-300">
                        <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`;

  const pricingComponent = `import React, { useState } from "react";

export function Pricing() {
  const [annual, setAnnual] = useState(false);

  return (
    <section id="pricing" className="py-24 sm:py-32 border-t border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-14">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary)] mb-3 block">TRANSPARENT PRICING</span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">Simple, Scalable Plans</h2>
          <p className="text-base sm:text-lg text-slate-400">Example pricing and features. Replace these with your actual plans before publishing.</p>

          <div className="inline-flex items-center gap-3 mt-8 p-1.5 rounded-full border border-white/10 bg-white/[0.04]">
            <button
              onClick={() => setAnnual(false)}
              className={\`px-5 py-2 rounded-full text-xs font-bold transition-all \${!annual ? "bg-[var(--primary)] text-white" : "text-slate-400 hover:text-white"}\`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={\`px-5 py-2 rounded-full text-xs font-bold transition-all \${annual ? "bg-[var(--primary)] text-white" : "text-slate-400 hover:text-white"}\`}
            >
              Annual <span className="ml-1 text-emerald-400 font-extrabold">Save 20%</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
          {/* Starter Tier */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Starter</h3>
              <p className="text-xs text-slate-400 mb-6">Perfect for early adopters and individual creators.</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-white">{annual ? "$23" : "$29"}</span>
                <span className="text-xs text-slate-400">{annual ? "/mo (billed annually)" : "/month"}</span>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-300 mb-8">
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Core feature access</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> 5 active projects</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Community support</li>
              </ul>
            </div>
            <a href="#contact" className="w-full text-center py-3 rounded-xl text-xs font-bold text-slate-200 border border-white/20 bg-white/5 hover:bg-white/10 transition-colors">Get Started</a>
          </div>

          {/* Pro Tier */}
          <div className="relative rounded-2xl border-2 border-[var(--primary)] bg-gradient-to-b from-white/[0.08] to-white/[0.02] p-8 backdrop-blur-2xl flex flex-col justify-between shadow-2xl md:-translate-y-2">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Professional</h3>
              <p className="text-xs text-slate-400 mb-6">Designed for growing teams needing full power.</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-white">{annual ? "$63" : "$79"}</span>
                <span className="text-xs text-slate-400">{annual ? "/mo (billed annually)" : "/month"}</span>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-300 mb-8">
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Everything in Starter</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Unlimited projects & assets</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Priority 24/7 support</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Advanced analytics</li>
              </ul>
            </div>
            <a href="#contact" className="w-full text-center py-3 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-95 shadow-lg transition-all">Claim Pro Access</a>
          </div>

          {/* Enterprise Tier */}
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all">
            <div>
              <h3 className="text-lg font-bold text-white mb-2">Enterprise</h3>
              <p className="text-xs text-slate-400 mb-6">Custom architecture and dedicated assistance.</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-extrabold text-white">{annual ? "$159" : "$199"}</span>
                <span className="text-xs text-slate-400">{annual ? "/mo (billed annually)" : "/month"}</span>
              </div>
              <ul className="space-y-3 text-xs sm:text-sm text-slate-300 mb-8">
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Dedicated account engineer</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Custom SLAs & security review</li>
                <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> White-label capabilities</li>
              </ul>
            </div>
            <a href="#contact" className="w-full text-center py-3 rounded-xl text-xs font-bold text-slate-200 border border-white/20 bg-white/5 hover:bg-white/10 transition-colors">Contact Enterprise</a>
          </div>
        </div>
      </div>
    </section>
  );
}`;

  const testimonialsComponent = `import React from "react";

const testimonials: { quote: string; name: string; role: string }[] = ${JSON.stringify(content.testimonials, null, 2)};

export function Testimonials() {
  return (
    <section id="testimonials" className="py-24 sm:py-32 border-t border-white/10 bg-white/[0.01]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--secondary)] mb-3 block">TESTIMONIALS</span>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">Customer reviews</h2>
          {testimonials.length === 0 && <p className="text-base text-slate-400">Add verified customer reviews before publishing.</p>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((item, idx) => (
            <div key={idx} className="relative rounded-2xl border border-white/10 bg-white/[0.04] p-6 sm:p-8 backdrop-blur-xl flex flex-col justify-between hover:border-white/20 transition-all">
              <div>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 italic">“{item.quote}”</p>
              </div>
              <div className="flex items-center gap-3 pt-4 border-t border-white/10">
                <div>
                  <h4 className="text-sm font-bold text-white">{item.name}</h4>
                  <p className="text-xs text-slate-400">{item.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`;

  const faqComponent = `import React from "react";

const faqItems = ${JSON.stringify(content.faq, null, 2)};

export function FAQ() {
  return (
    <section id="faq" className="py-24 sm:py-32 border-t border-white/10">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--primary)] mb-3 block">FAQ</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">Frequently Asked Questions</h2>
          <p className="text-base text-slate-400">Everything you need to know about ${plan.siteName}.</p>
        </div>

        <div className="space-y-4">
          {faqItems.map((item, idx) => (
            <details key={idx} className="group rounded-xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-md transition-all open:bg-white/[0.06] open:border-indigo-500/30">
              <summary className="flex cursor-pointer items-center justify-between font-semibold text-white text-base">
                <span>{item.question}</span>
                <span className="ml-4 flex-shrink-0 text-slate-400 transition-transform duration-300 group-open:rotate-180">▼</span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}`;

  const contactComponent = `import React, { useState } from "react";

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 5000);
  };

  return (
    <section id="contact" className="py-24 sm:py-32 border-t border-white/10 relative">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="text-xs font-bold uppercase tracking-widest text-[var(--secondary)] mb-3 block">GET IN TOUCH</span>
        <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">${requestedSections.has("reservation") ? "Reserve a table" : "Get in touch"}</h2>
        <p className="text-base sm:text-lg text-slate-300 mb-10">Preview form. Connect a submission endpoint to receive inquiries.</p>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-white/15 bg-slate-950/80 p-6 sm:p-10 backdrop-blur-2xl text-left shadow-2xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
            <div>
              <label htmlFor="contact-name" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Full Name</label>
              <input type="text" id="contact-name" required placeholder="Alex Morgan" className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[var(--primary)]" />
            </div>
            <div>
              <label htmlFor="contact-email" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Email Address</label>
              <input type="email" id="contact-email" required placeholder="alex@company.com" className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[var(--primary)]" />
            </div>
          </div>
          ${requestedSections.has("reservation") ? '<div className="mb-6 grid gap-4 sm:grid-cols-2"><label>Visit date<input name="visit-date" type="date" required className="block w-full rounded-lg p-2 text-slate-900" /></label><label>Number of guests<input name="guests" type="number" min={1} required className="block w-full rounded-lg p-2 text-slate-900" /></label></div>' : ""}
          <div className="mb-6">
            <label htmlFor="contact-message" className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">Message or Requirement</label>
            <textarea id="contact-message" rows={4} required placeholder="Tell us about your requirements..." className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-[var(--primary)]"></textarea>
          </div>
          <button type="submit" className="w-full py-4 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[var(--primary)] to-[var(--secondary)] hover:opacity-95 shadow-lg shadow-indigo-500/25 transition-all">
            Send Inquiry
          </button>
        </form>

        {submitted && (
          <div className="mt-6 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 text-sm font-semibold">
            Preview submission complete. No message was sent.
          </div>
        )}
      </div>
    </section>
  );
}`;

  const footerComponent = `import React from "react";

export function Footer() {
  return (
    <footer className="border-t border-white/10 py-12 bg-slate-950 text-slate-400 text-xs sm:text-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--primary)] to-[var(--secondary)] flex items-center justify-center font-bold text-white text-xs">
            ${plan.siteName.charAt(0).toUpperCase()}
          </div>
          <span className="font-bold text-white">${plan.siteName}</span>
        </div>
        <div>
          © {new Date().getFullYear()} ${plan.siteName}. Autonomous Generation by SiteCraft AI.
        </div>
        <div className="flex items-center gap-6">
          <a href="#top" className="hover:text-white transition-colors">Back to Top ↑</a>
        </div>
      </div>
    </footer>
  );
}`;

  const aboutComponent = `import React from "react";

export function About() {
  return (
    <section id="about" className="py-24 sm:py-32 border-t border-white/10 bg-white/[0.01]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[var(--secondary)] mb-3 block">${requestedSections.has("story") ? "OUR STORY" : "ABOUT"}</span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-6">${requestedSections.has("story") ? "Our story, served with care" : `A closer look at ${plan.siteName}`}</h2>
          <p className="text-slate-300 text-base sm:text-lg leading-relaxed">${content.sections[1]?.body || plan.siteDescription}</p>
        </div>
        <img src="${aboutImage}" alt="About ${plan.siteName}" className="w-full h-80 sm:h-96 object-cover rounded-2xl border border-white/15" loading="lazy" />
      </div>
    </section>
  );
}`;

  const optionalImports = [
    showAbout ? 'import { About } from "./components/About";' : "",
    showPricing ? 'import { Pricing } from "./components/Pricing";' : "",
    showTestimonials ? 'import { Testimonials } from "./components/Testimonials";' : "",
    showFaq ? 'import { FAQ } from "./components/FAQ";' : "",
    requestedSections.has("contact") || requestedSections.has("reservation") ? 'import { ContactForm } from "./components/ContactForm";' : ""
  ].filter(Boolean).join("\n");
  const optionalComponents = [
    showAbout ? "        <About />" : "",
    showPricing ? "        <Pricing />" : "",
    showTestimonials ? "        <Testimonials />" : "",
    showFaq ? "        <FAQ />" : "",
    requestedSections.has("contact") || requestedSections.has("reservation") ? "        <ContactForm />" : ""
  ].filter(Boolean).join("\n");
  const generatedReadme = [
    `# ${plan.siteName}`,
    "",
    "Generated by SiteCraft AI from a structured website brief.",
    "AI-generated draft content — verify before publishing. Connect any demo forms to a real submission endpoint before accepting inquiries.",
    "",
    "## Component Hierarchy",
    ...exportComponentNames.map((name) => `- \`${name}\``),
    "",
    "## Local Development",
    "```bash",
    "npm install",
    "npm run dev",
    "npm run build",
    "```",
    ""
  ].join("\n");

  const appComponent = `import React from "react";
import { Navbar } from "./components/Navbar";
import { Hero } from "./components/Hero";
import { Features } from "./components/Features";
${optionalImports}
import { Footer } from "./components/Footer";
import "./styles.css";

export default function App() {
  return (
    <div className="sitecraft-app min-h-screen bg-slate-950 text-slate-50 font-sans">
      <Navbar />
      <main>
        <Hero />
        <Features />
${optionalComponents}
      </main>
      <Footer />
    </div>
  );
}`;

  return [
    { path: "src/App.tsx", language: "tsx", content: appComponent },
    { path: "src/components/Navbar.tsx", language: "tsx", content: navbarComponent },
    { path: "src/components/Hero.tsx", language: "tsx", content: heroComponent },
    { path: "src/components/Features.tsx", language: "tsx", content: featuresComponent },
    ...(showAbout ? [{ path: "src/components/About.tsx", language: "tsx", content: aboutComponent }] : []),
    ...(showPricing ? [{ path: "src/components/Pricing.tsx", language: "tsx", content: pricingComponent }] : []),
    ...(showTestimonials ? [{ path: "src/components/Testimonials.tsx", language: "tsx", content: testimonialsComponent }] : []),
    ...(showFaq ? [{ path: "src/components/FAQ.tsx", language: "tsx", content: faqComponent }] : []),
    ...(requestedSections.has("contact") || requestedSections.has("reservation") ? [{ path: "src/components/ContactForm.tsx", language: "tsx", content: contactComponent }] : []),
    { path: "src/components/Footer.tsx", language: "tsx", content: footerComponent },
    {
      path: "src/styles.css",
      language: "css",
      content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  --primary: ${plan.colorPalette.primary};\n  --secondary: ${plan.colorPalette.secondary};\n  --background: ${plan.colorPalette.background};\n  --foreground: ${plan.colorPalette.foreground};\n}\nbody {\n  background-color: var(--background);\n  color: var(--foreground);\n  font-family: ${plan.fontFamily};\n}`
    },
    {
      path: "src/main.tsx",
      language: "tsx",
      content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App";\n\ncreateRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);`
    },
    { path: "index.html", language: "html", content: html },
    {
      path: "package.json",
      language: "json",
      content: JSON.stringify(
        {
          name: plan.siteName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "generated-site",
          private: true,
          version: "0.1.0",
          type: "module",
          scripts: { dev: "vite", build: "tsc && vite build" },
          dependencies: { react: "^18.3.1", "react-dom": "^18.3.1" },
          devDependencies: { vite: "^5.4.2", typescript: "^5.5.3", "@types/react": "^18.3.3", "@types/react-dom": "^18.3.0", tailwindcss: "^3.4.1", postcss: "^8.4.49", autoprefixer: "^10.4.20" }
        },
        null,
        2
      )
    },
    {
      path: "README.md",
      language: "md",
      content: generatedReadme
    },
    {
      path: "tsconfig.json",
      language: "json",
      content: JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          useDefineForClassFields: true,
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          allowJs: false,
          skipLibCheck: true,
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          strict: true,
          forceConsistentCasingInFileNames: true,
          module: "ESNext",
          moduleResolution: "Node",
          resolveJsonModule: true,
          isolatedModules: true,
          noEmit: true,
          jsx: "react-jsx"
        },
        include: ["src"]
      }, null, 2)
    },
    {
      path: "tailwind.config.cjs",
      language: "js",
      content: `/** @type {import('tailwindcss').Config} */\nmodule.exports = { content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"], theme: { extend: {} }, plugins: [] };\n`
    },
    {
      path: "postcss.config.cjs",
      language: "js",
      content: `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`
    },
    { path: ".env.example", language: "bash", content: "# Add client-safe public values here.\n" }
  ];
}
