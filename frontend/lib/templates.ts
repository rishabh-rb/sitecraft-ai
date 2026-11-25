import type { GeneratedWebsite } from "./api";

export type Template = {
  id: string;
  name: string;
  industry: string;
  tag: string;
  title: string;
  subtitle: string;
  accent: string;
  background: string;
  image: string;
  prompt: string;
  sections: string[];
};
const photo = (id: string) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=1200&q=80`;
export const templates: Template[] = [
  {
    id: "restaurant",
    name: "Saffron & Stone",
    industry: "Restaurant",
    tag: "Warm · Editorial",
    title: "Good food.\nGreat company.",
    subtitle:
      "Seasonal ingredients, thoughtful plates, and a little time to slow down.",
    accent: "#9b442b",
    background: "#f5efe4",
    image: photo("photo-1517248135467-4c7edcad34c4"),
    prompt:
      "Create a warm editorial restaurant website with a seasonal menu, a story section, opening hours and a reservation enquiry form. Use earthy terracotta, cream and elegant serif typography. Avoid invented reviews or awards.",
    sections: ["Seasonal menu", "Our story", "Reservations"],
  },
  {
    id: "saas",
    name: "Orbit",
    industry: "SaaS",
    tag: "Clean · Product-led",
    title: "Less busywork.\nMore possibility.",
    subtitle:
      "One thoughtful workspace to turn your next big idea into meaningful progress.",
    accent: "#6554c0",
    background: "#f5f4fc",
    image: photo("photo-1551288049-bebda4e38f71"),
    prompt:
      "Build a modern SaaS landing page for Orbit, a team planning tool. Include a product preview, features, a workflow section, transparent pricing placeholders and a demo request form. Use violet and off-white. Do not invent adoption metrics.",
    sections: ["A calmer workflow", "Built for your team", "Get a demo"],
  },
  {
    id: "portfolio",
    name: "Alex Morgan",
    industry: "Portfolio",
    tag: "Minimal · Expressive",
    title: "Thoughtful design.\nLasting impressions.",
    subtitle:
      "A selection of digital experiences, shaped with curiosity and intention.",
    accent: "#28584e",
    background: "#edf1e8",
    image: photo("photo-1460925895917-afdab827c52f"),
    prompt:
      "Create a minimal designer portfolio with a bold introduction, three sample project case studies clearly labeled as sample work, an about section and a contact form. Use sage green, oversized type and generous whitespace.",
    sections: ["Selected work", "A little about me", "Let’s collaborate"],
  },
  {
    id: "ecommerce",
    name: "Forma Objects",
    industry: "Ecommerce",
    tag: "Refined · Lifestyle",
    title: "Everyday objects.\nConsidered differently.",
    subtitle:
      "Useful, beautiful pieces for the spaces and rituals that make life yours.",
    accent: "#79573e",
    background: "#f3eee8",
    image: photo("photo-1509440159596-0249088772ff"),
    prompt:
      "Design a refined home goods storefront with collection cards, sample products, brand story and an enquiry form. Clearly label sample prices and demo shopping interactions; no payment integration claims. Use warm neutrals and elegant typography.",
    sections: ["The collection", "Made with intention", "Stay in the loop"],
  },
  {
    id: "agency",
    name: "Studio North",
    industry: "Agency",
    tag: "Bold · Creative",
    title: "Small studio.\nAmbitious ideas.",
    subtitle:
      "We bring clarity, character and a fresh perspective to brands moving forward.",
    accent: "#d94e32",
    background: "#f8f1e6",
    image: photo("photo-1522071820081-009f0129c71c"),
    prompt:
      "Build a bold creative agency website with brand strategy, design and development services, sample work clearly labeled, a process section and a project enquiry form. Use coral and cream, confident typography and asymmetrical layouts.",
    sections: ["What we do", "How we work", "Start something good"],
  },
  {
    id: "healthcare",
    name: "Willow Care",
    industry: "Healthcare",
    tag: "Calm · Accessible",
    title: "Care that starts\nwith listening.",
    subtitle:
      "A welcoming space to ask questions and explore support for your wellbeing.",
    accent: "#216e65",
    background: "#eef4ef",
    image: photo("photo-1576091160399-112ba8d25d1d"),
    prompt:
      "Create an accessible clinic information website with services, care approach, opening hours and an appointment enquiry form. No medical advice, guarantees, invented credentials or patient testimonials. Use calming green and readable typography.",
    sections: ["Our services", "Your care journey", "Appointment enquiry"],
  },
  {
    id: "event",
    name: "OFFLINE / 26",
    industry: "Event",
    tag: "Vibrant · Immersive",
    title: "Good ideas happen\nwhen we connect.",
    subtitle:
      "A gathering for curious minds, fresh perspectives and the conversations that matter.",
    accent: "#bf432e",
    background: "#ffe9d1",
    image: photo("photo-1505373877841-8d25f7d46678"),
    prompt:
      "Build a vibrant creative conference website with an example agenda, session themes, venue information placeholders and a registration enquiry. Mark dates and speakers as draft content. Use burnt orange, bold typography and warm cream.",
    sections: ["The programme", "A space to connect", "Register interest"],
  },
  {
    id: "education",
    name: "Open Chapter",
    industry: "Education",
    tag: "Friendly · Structured",
    title: "Make room for\nyour next chapter.",
    subtitle:
      "Explore practical ideas, build new skills and keep your curiosity moving.",
    accent: "#315c9e",
    background: "#eef2f8",
    image: photo("photo-1523050854058-8df90110c9f1"),
    prompt:
      "Create a friendly learning website with sample course cards, a learning approach section, FAQ and course enquiry form. Clearly mark sample courses and avoid invented accreditation. Use soft blue, warm white and accessible typography.",
    sections: ["Explore new skills", "Learn your way", "Find your next step"],
  },
];
export const fonts = ["Arial", "Georgia", "Trebuchet MS", "Verdana"];
export type DesignOptions = {
  accent: string;
  font: string;
  radius: number;
  spacing: number;
  width: number;
  dark: boolean;
  logo: string;
  language: string;
};
export const defaultDesign: DesignOptions = {
  accent: "#9b442b",
  font: "Georgia",
  radius: 16,
  spacing: 72,
  width: 1180,
  dark: false,
  logo: "",
  language: "en",
};
export const escapeHtml = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function inferTemplate(prompt: string): Template {
  const explicit = templates.find((item) =>
    new RegExp(`\\b(${item.id}|${item.industry})\\b`, "i").test(prompt),
  );
  if (explicit) return explicit;
  const keywords: Record<string, RegExp> = {
    restaurant: /\b(caf[eé]|bistro|dining|culinary|seasonal menu)\b/i,
    ecommerce: /\b(e-commerce|storefront|shopping|shop|home goods|products)\b/i,
    healthcare: /\b(clinic|medical|hospital|dentist|wellbeing)\b/i,
    education: /\b(learning|course|school|university|academy|tutor)\b/i,
    event: /\b(conference|concert|festival|registration|gathering)\b/i,
    portfolio: /\b(photographer|personal brand|case studies)\b/i,
    agency: /\b(studio|brand strategy|creative services)\b/i,
  };
  return (
    templates.find((item) => keywords[item.id]?.test(prompt)) || templates[1]
  );
}
export function templateWebsite(
  template: Template,
  options: Partial<DesignOptions> = {},
): GeneratedWebsite {
  const d = {
    ...defaultDesign,
    accent: template.accent,
    font: ["saas", "agency", "event", "education"].includes(template.id)
      ? "Arial"
      : "Georgia",
    ...options,
  };
  const es = d.language === "es",
    hi = d.language === "hi";
  const title = hi
    ? "आपके अगले विचार को\nएक नई शुरुआत।"
    : es
      ? "Tu próxima idea.\nUn nuevo comienzo."
      : template.title;
  const subtitle = hi
    ? "सोच-समझकर बनाया गया एक अनुभव। जानें, खोजें और हमसे जुड़ें।"
    : es
      ? "Una experiencia creada con intención. Explora, descubre y conecta con nosotros."
      : template.subtitle;
  const sections = hi
    ? ["हमारी पेशकश", "हमारी कहानी", "संपर्क करें"]
    : es
      ? ["Nuestra propuesta", "Nuestra historia", "Hablemos"]
      : template.sections;
  const cards =
    template.id === "restaurant"
      ? ["From the garden", "From the kitchen", "Something sweet"]
      : template.id === "saas"
        ? ["Plan with purpose", "Bring it together", "See what’s next"]
        : template.id === "ecommerce"
          ? ["For your mornings", "For your space", "For the everyday"]
          : template.id === "education"
            ? ["Design foundations", "Creative thinking", "Digital essentials"]
            : ["Discover the details", "A thoughtful approach", "Made for you"];
  const html = `<!doctype html><html lang="${d.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(template.name)} — ${escapeHtml(sections[0])}</title><meta name="description" content="${escapeHtml(subtitle)}"><meta name="keywords" content="${escapeHtml(template.industry)}, ${escapeHtml(template.name)}"><meta property="og:title" content="${escapeHtml(template.name)}"><meta property="og:description" content="${escapeHtml(subtitle)}"><style>:root{--brand:${d.accent};--surface:${d.dark ? "#191d1b" : template.background};--ink:${d.dark ? "#f5f1e9" : "#20251f"};--radius:${d.radius}px;--space:${d.spacing}px;--page:${d.width}px}*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--surface);color:var(--ink);font-family:'${d.font}',sans-serif;font-size:16px;line-height:1.65}a{color:inherit;text-decoration:none}button,input{font:inherit}button,a,input{outline-offset:5px}nav,.wrap{width:min(var(--page),90%);margin:auto}nav{display:flex;align-items:center;justify-content:space-between;gap:24px;min-height:94px;border-bottom:1px solid #8884}.brand{font-size:23px;font-weight:700;letter-spacing:-1px}.brand img{max-height:42px;max-width:120px;vertical-align:middle;margin-right:12px}.links{display:flex;gap:28px;font-family:Arial,sans-serif;font-size:14px}.pill,.cta{display:inline-block;background:var(--brand);color:white;padding:12px 24px;border-radius:var(--radius);border:0;cursor:pointer;font-family:Arial,sans-serif;font-weight:600}.hero{display:grid;grid-template-columns:1fr 1fr;gap:7%;align-items:center;padding:var(--space) 0}.eyebrow{font:600 12px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:var(--brand)}h1{font-size:clamp(40px,5.4vw,76px);line-height:1.06;letter-spacing:-3px;margin:24px 0;font-weight:${d.font === "Georgia" ? "400" : "700"}}h1 span{display:block}h2{font-size:clamp(30px,3.5vw,48px);line-height:1.15;letter-spacing:-1.5px;font-weight:500;margin:12px 0 20px}.intro{max-width:450px;opacity:.75;margin-bottom:30px}.hero img{width:100%;height:480px;object-fit:cover;border-radius:${template.id === "restaurant" ? "46% 46% 8px 8px" : "var(--radius)"}}section{padding:var(--space) 0;border-bottom:1px solid #8883}.cards{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:36px}.card{padding:30px 24px;border:1px solid #8884;border-radius:var(--radius);background:#ffffff09}.card b{display:block;font:600 22px Arial,sans-serif;margin:18px 0 10px}.card p{opacity:.7;font-family:Arial,sans-serif;font-size:15px}.number{font:500 13px Arial,sans-serif;color:var(--brand)}.story{display:grid;grid-template-columns:1fr 1fr;gap:60px;align-items:start}.contact{display:flex;justify-content:space-between;align-items:center;gap:40px}form{max-width:430px;width:100%;font-family:Arial,sans-serif}label{display:block;font-size:14px;margin:12px 0 6px}input{display:block;width:100%;border:1px solid #8887;padding:12px 16px;background:transparent;color:inherit;border-radius:var(--radius)}form button{margin-top:20px}footer{padding:32px 0;display:flex;justify-content:space-between;font:13px Arial,sans-serif;gap:20px;opacity:.7}.draft{font:12px Arial,sans-serif;opacity:.65;margin-top:16px}.menu{display:none}@media(max-width:680px){nav{min-height:76px}.links{display:none}.menu{display:block;border:1px solid #8886;background:transparent;color:inherit;padding:8px 12px;border-radius:8px}.links.open{display:flex;position:absolute;top:76px;left:0;width:100%;padding:20px;background:var(--surface);z-index:2;flex-wrap:wrap}.hero{grid-template-columns:1fr;gap:32px;padding:40px 0}.hero img{height:330px}h1{letter-spacing:-2px}.cards,.story{grid-template-columns:1fr}.contact{display:block}form{margin-top:24px}section{padding:40px 0}footer{flex-wrap:wrap}}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}</style></head><body><nav><a class="brand" href="#home">${d.logo ? `<img src="${escapeHtml(d.logo)}" alt="${escapeHtml(template.name)} logo">` : ""}${escapeHtml(template.name)}</a><button class="menu" aria-label="Toggle navigation" aria-expanded="false" onclick="var n=document.querySelector('.links');n.classList.toggle('open');this.setAttribute('aria-expanded',n.classList.contains('open'))">Menu</button><div class="links"><a href="#offer">${escapeHtml(sections[0])}</a><a href="#story">${escapeHtml(sections[1])}</a><a href="#contact">${escapeHtml(sections[2])}</a></div></nav><main class="wrap"><section id="home" class="hero"><div><div class="eyebrow">${escapeHtml(template.industry)} / ${escapeHtml(template.tag.split(" · ")[0])}</div><h1>${title
    .split("\n")
    .map((line) => `<span>${escapeHtml(line)}</span>`)
    .join(
      "",
    )}</h1><p class="intro">${escapeHtml(subtitle)}</p><a class="cta" href="#offer">${hi ? "और जानें" : es ? "Explorar" : "Take a closer look"}</a><p class="draft">${hi ? "नमूना वेबसाइट · प्रकाशित करने से पहले विवरण जाँचें" : es ? "Sitio de ejemplo · Revisa el contenido antes de publicar" : "Sample website · Replace draft content before publishing"}</p></div><img src="${template.image}" alt="${escapeHtml(template.industry)} inspiration for ${escapeHtml(template.name)}" width="620" height="680"></section><section id="offer"><span class="eyebrow">01 / ${hi ? "खोजें" : es ? "Descubre" : "Discover"}</span><h2>${escapeHtml(sections[0])}</h2><div class="cards">${cards.map((card, i) => `<article class="card"><span class="number">0${i + 1}</span><b>${hi ? ["रचनात्मक विचार", "सरल अनुभव", "एक नई शुरुआत"][i] : es ? ["Ideas creativas", "Una experiencia sencilla", "Un nuevo comienzo"][i] : card}</b><p>${hi ? "आपकी आवश्यकताओं के अनुसार तैयार नमूना सामग्री।" : es ? "Contenido de ejemplo para adaptar a tus necesidades." : "A little inspiration for what comes next. Replace this sample with your own details."}</p></article>`).join("")}</div></section><section id="story" class="story"><div><span class="eyebrow">02 / ${hi ? "हमारी कहानी" : es ? "Nuestra historia" : "Our perspective"}</span><h2>${escapeHtml(sections[1])}</h2></div><p>${hi ? "हम मानते हैं कि छोटी-छोटी बातों पर ध्यान देना सबसे महत्वपूर्ण है। अपने काम और उद्देश्य की कहानी यहाँ जोड़ें।" : es ? "Creemos en los pequeños detalles y en crear con intención. Añade aquí la historia real de tu proyecto." : "We believe the best experiences start with the details. With a considered approach and a clear sense of purpose, there’s room to make something meaningful. Add your own story here."}</p></section><section id="contact" class="contact"><div><span class="eyebrow">03 / ${hi ? "जुड़ें" : es ? "Conecta" : "Let’s connect"}</span><h2>${escapeHtml(sections[2])}</h2><p>${hi ? "हमसे बातचीत शुरू करें।" : es ? "Empecemos una conversación." : "Every good thing starts with a conversation."}</p></div><form onsubmit="event.preventDefault();this.querySelector('[role=status]').textContent='Preview only — no information was sent.'"><label for="contact-name">${hi ? "नाम" : es ? "Nombre" : "Your name"}</label><input id="contact-name" name="name" autocomplete="name" required><label for="contact-email">${hi ? "ईमेल" : es ? "Correo electrónico" : "Email address"}</label><input id="contact-email" name="email" type="email" autocomplete="email" required><button class="cta" type="submit">${hi ? "संपर्क करें" : es ? "Contactar" : "Get in touch"}</button><p role="status" class="draft">${hi ? "नमूना फ़ॉर्म · कोई जानकारी नहीं भेजी जाएगी" : es ? "Formulario de ejemplo · No se envían datos" : "Preview form · Nothing will be sent"}</p></form></section><footer><span>© ${new Date().getFullYear()} ${escapeHtml(template.name)}</span><span>Sample content · Built with SiteCraft AI</span></footer></main><script>document.addEventListener('click',function(e){var a=e.target.closest('a');var href=a&&a.getAttribute('href');if(href&&href.startsWith('#')){e.preventDefault();var target=document.getElementById(href.slice(1));if(target)target.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'auto':'smooth'})}});</script></body></html>`;
  return {
    html,
    plan: {
      siteName: template.name,
      siteDescription: subtitle,
      pages: [{ name: "Home", slug: "/", pageType: template.id, sections }],
      theme: d.dark ? "dark" : "light",
      colorPalette: {
        primary: d.accent,
        background: template.background,
        text: d.dark ? "#f5f1e9" : "#20251f",
      },
      fontFamily: d.font,
      features: sections,
    },
    files: [
      { path: "index.html", language: "html", content: html },
      {
        path: "README.md",
        language: "markdown",
        content: `# ${template.name}\n\nA SiteCraft template draft. Open index.html in a browser. Replace sample content and connect forms before publishing. Photos served by Unsplash.\n`,
      },
    ],
  };
}
export function prepareTemplate(
  template: Template,
  options: Partial<DesignOptions> = {},
) {
  try {
    localStorage.setItem(
      "sitecraft-template-draft",
      JSON.stringify({
        templateId: template.id,
        options,
        prompt: template.prompt,
      }),
    );
  } catch {
    /* The dashboard also receives the template ID. */
  }
  return `/dashboard?template=${template.id}`;
}
