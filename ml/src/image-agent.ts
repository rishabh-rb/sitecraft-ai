import type { WebsitePlan } from "./types.js";

export interface ImageAsset {
  kind: string;
  description: string;
  alt: string;
  url: string;
}

const CURATED_TOPIC_IMAGES: Record<string, ImageAsset[]> = {
  saas: [
    {
      kind: "hero",
      description: "Modern SaaS product analytics interface on glass desk",
      alt: "SaaS analytics dashboard with glowing metrics on modern workstation",
      url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&w=1600&q=80"
    },
    {
      kind: "feature-1",
      description: "Automated workflow engine and cloud orchestration",
      alt: "Interactive cloud pipeline and high-performance server network",
      url: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-2",
      description: "Enterprise security and end-to-end encryption",
      alt: "Digital biometric lock and enterprise security firewall visualization",
      url: "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-3",
      description: "Real-time AI insights and predictive graphs",
      alt: "Team analyzing dynamic predictive analytics on large digital displays",
      url: "https://images.unsplash.com/photo-1504868584819-f8e8b4b6d7e3?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "about",
      description: "Collaborative engineering leadership team",
      alt: "Multicultural product team collaborating in a bright open-plan studio",
      url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80"
    },
    {
      kind: "avatar-1",
      description: "Sarah Jenkins, CTO at NovaTech",
      alt: "Portrait of Sarah Jenkins smiling in modern tech office",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-2",
      description: "Alex Chen, VP of Product at Horizon AI",
      alt: "Portrait of Alex Chen in studio lighting",
      url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-3",
      description: "Elena Rostova, Founder of ScaleSphere",
      alt: "Portrait of Elena Rostova with warm lighting",
      url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80"
    }
  ],
  restaurant: [
    {
      kind: "hero",
      description: "Exquisite culinary plating in ambient dining room",
      alt: "Artisan gourmet dish beautifully presented with candlelight",
      url: "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1600&q=80"
    },
    {
      kind: "feature-1",
      description: "Organic farm-to-table seasonal harvest",
      alt: "Fresh organic herbs and garden vegetables prepared by master chefs",
      url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-2",
      description: "Handcrafted mixology and reserve vintage wines",
      alt: "Smoky craft cocktail with botanical garnish on black marble bar",
      url: "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-3",
      description: "Wood-fired artisanal baking and hearth gastronomy",
      alt: "Rustic sourdough and wood-fired delicacies fresh out of the stone oven",
      url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "about",
      description: "Executive chef garnishing tasting menu",
      alt: "Award-winning chef delicately plating an omakase course",
      url: "https://images.unsplash.com/photo-1577219491135-ce391730fb2c?auto=format&fit=crop&w=1200&q=80"
    },
    {
      kind: "avatar-1",
      description: "Marcus Rivera, Food Critic",
      alt: "Portrait of Marcus Rivera dining",
      url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-2",
      description: "Chloe Dupuis, Sommelier",
      alt: "Portrait of Chloe Dupuis with wine glass",
      url: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-3",
      description: "Liam Vance, Private Event Organizer",
      alt: "Portrait of Liam Vance in restaurant lounge",
      url: "https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?auto=format&fit=crop&w=300&q=80"
    }
  ],
  portfolio: [
    {
      kind: "hero",
      description: "Minimalist creative workspace with dual 4K monitors",
      alt: "Clean aesthetic workstation with code editor and mechanical keyboard",
      url: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?auto=format&fit=crop&w=1600&q=80"
    },
    {
      kind: "feature-1",
      description: "Full-stack React and Next.js web applications",
      alt: "Sleek dark-mode interface mockups and responsive design layouts",
      url: "https://images.unsplash.com/photo-1581291518655-9523c93269c3?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-2",
      description: "Interactive 3D graphics and mobile engineering",
      alt: "Futuristic 3D interaction render on mobile device screen",
      url: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-3",
      description: "High-performance cloud architecture & APIs",
      alt: "Distributed server metrics and low-latency API benchmark dashboards",
      url: "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "about",
      description: "Creative engineer portrait in natural studio lighting",
      alt: "Portrait of developer holding coffee in a modern loft space",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80"
    },
    {
      kind: "avatar-1",
      description: "Devon Reed, Staff Architect",
      alt: "Portrait of Devon Reed",
      url: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-2",
      description: "Maya Lin, Design Director",
      alt: "Portrait of Maya Lin",
      url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-3",
      description: "Jordan Bell, Startup Founder",
      alt: "Portrait of Jordan Bell",
      url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=300&q=80"
    }
  ],
  ecommerce: [
    {
      kind: "hero",
      description: "Curated luxury lifestyle collection showcased in gallery",
      alt: "Premium handcrafted collection arranged in an editorial showroom",
      url: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1600&q=80"
    },
    {
      kind: "feature-1",
      description: "Sustainable ethically-sourced materials",
      alt: "Close-up of premium eco-conscious textures and stitching",
      url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-2",
      description: "Global expedited carbon-neutral shipping",
      alt: "Recyclable minimal packaging with custom ribbon and seal",
      url: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-3",
      description: "Concierge 24/7 client styling service",
      alt: "Personal shopper preparing boutique collection on oak table",
      url: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "about",
      description: "Artisan craftsmanship in heritage workshop",
      alt: "Artisan handcrafting leather goods with precision brass tools",
      url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=1200&q=80"
    },
    {
      kind: "avatar-1",
      description: "Aria Thorne, Fashion Editor",
      alt: "Portrait of Aria Thorne",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-2",
      description: "Kai Henderson, Verified Buyer",
      alt: "Portrait of Kai Henderson",
      url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-3",
      description: "Sofia Castillo, Lifestyle Blogger",
      alt: "Portrait of Sofia Castillo",
      url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=300&q=80"
    }
  ],
  fitness: [
    {
      kind: "hero",
      description: "High-energy boutique fitness athletic arena",
      alt: "Athlete training in state-of-the-art gym with neon ambient lighting",
      url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1600&q=80"
    },
    {
      kind: "feature-1",
      description: "Personalized Olympic-grade strength training",
      alt: "Barbell training and functional fitness equipment",
      url: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-2",
      description: "Nutrition science and biometric meal planning",
      alt: "Fresh balanced protein meal bowl and cold-pressed recovery juice",
      url: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-3",
      description: "Recovery spa, cryotherapy, and sauna",
      alt: "Relaxing minimalist recovery sauna with cedar woodwork",
      url: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "about",
      description: "Certified trainers coaching small group class",
      alt: "Energetic fitness coach leading high-intensity interval workout",
      url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1200&q=80"
    },
    {
      kind: "avatar-1",
      description: "Tyler Ross, Marathon Runner",
      alt: "Portrait of Tyler Ross in athletic gear",
      url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-2",
      description: "Jessica Ward, Crossfit Athlete",
      alt: "Portrait of Jessica Ward",
      url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-3",
      description: "Dave Miller, Fitness Enthusiast",
      alt: "Portrait of Dave Miller",
      url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
    }
  ],
  default: [
    {
      kind: "hero",
      description: "Contemporary architectural innovation space",
      alt: "Futuristic open-concept architectural studio flooded with natural light",
      url: "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80"
    },
    {
      kind: "feature-1",
      description: "Tailored precision design and engineering",
      alt: "Precision design blueprints and tactile luxury hardware components",
      url: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-2",
      description: "Seamless intuitive user experiences",
      alt: "Happy customer enjoying modern digital touch interface",
      url: "https://images.unsplash.com/photo-1556742049-0a67e5572293?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "feature-3",
      description: "Sustainable long-term performance and growth",
      alt: "Lush botanical greenhouse with clean modern solar technology",
      url: "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=800&q=80"
    },
    {
      kind: "about",
      description: "Visionary creative workshop and team headquarters",
      alt: "Team gathered around conference table in glass atrium",
      url: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1200&q=80"
    },
    {
      kind: "avatar-1",
      description: "Emily Vance, Design Strategist",
      alt: "Portrait of Emily Vance",
      url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-2",
      description: "David Kross, Managing Partner",
      alt: "Portrait of David Kross",
      url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=300&q=80"
    },
    {
      kind: "avatar-3",
      description: "Rachel Zane, Lead Consultant",
      alt: "Portrait of Rachel Zane",
      url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=80"
    }
  ]
};

export function detectCategory(prompt: string, plan?: Partial<WebsitePlan>): string {
  const combined = `${prompt} ${plan?.siteName ?? ""} ${plan?.siteDescription ?? ""} ${plan?.theme ?? ""}`.toLowerCase();
  if (combined.includes("restaurant") || combined.includes("cafe") || combined.includes("food") || combined.includes("dining") || combined.includes("bakery") || combined.includes("coffee") || combined.includes("bistro") || combined.includes("chef") || combined.includes("bar")) {
    return "restaurant";
  }
  if (combined.includes("portfolio") || combined.includes("resume") || combined.includes("developer") || combined.includes("designer") || combined.includes("personal") || combined.includes("freelance") || combined.includes("cv")) {
    return "portfolio";
  }
  if (combined.includes("shop") || combined.includes("store") || combined.includes("ecommerce") || combined.includes("e-commerce") || combined.includes("product") || combined.includes("clothing") || combined.includes("fashion") || combined.includes("apparel") || combined.includes("retail")) {
    return "ecommerce";
  }
  if (combined.includes("gym") || combined.includes("fitness") || combined.includes("workout") || combined.includes("trainer") || combined.includes("health") || combined.includes("crossfit") || combined.includes("yoga") || combined.includes("wellness")) {
    return "fitness";
  }
  if (combined.includes("saas") || combined.includes("software") || combined.includes("platform") || combined.includes("cloud") || combined.includes("app") || combined.includes("startup") || combined.includes("automation") || combined.includes("b2b") || combined.includes("tool") || combined.includes("ai") || combined.includes("tech") || combined.includes("code")) {
    return "saas";
  }
  return "default";
}

export async function generateImages(prompt: string, plan: WebsitePlan, accessKey?: string): Promise<ImageAsset[]> {
  const category = detectCategory(prompt, plan);
  const fallbackAssets = CURATED_TOPIC_IMAGES[category] || CURATED_TOPIC_IMAGES.default;

  if (!accessKey) {
    return fallbackAssets;
  }

  try {
    const query = encodeURIComponent(`${plan.siteName} ${category}`);
    const response = await fetch(`https://api.unsplash.com/search/photos?query=${query}&per_page=6&orientation=landscape`, {
      signal: AbortSignal.timeout(5_000),
      headers: {
        Authorization: `Client-ID ${accessKey}`
      }
    });

    if (!response.ok) {
      console.warn(`Unsplash API returned status ${response.status}, using curated fallback images.`);
      return fallbackAssets;
    }

    const data = (await response.json()) as {
      results?: Array<{
        alt_description?: string;
        description?: string;
        urls?: { regular?: string; small?: string; full?: string };
      }>;
    };

    if (!data.results || data.results.length === 0) {
      return fallbackAssets;
    }

    const kinds = ["hero", "feature-1", "feature-2", "feature-3", "about"];
    const fetchedAssets: ImageAsset[] = data.results.slice(0, 5).map((item, idx) => ({
      kind: kinds[idx] || `feature-${idx + 1}`,
      description: item.description || item.alt_description || `${plan.siteName} visual`,
      alt: item.alt_description || item.description || `${plan.siteName} illustration`,
      url: item.urls?.regular || fallbackAssets[idx]?.url || fallbackAssets[0].url
    }));

    // Append avatar assets from curated fallback so testimonials always have realistic faces
    const avatars = fallbackAssets.filter((a) => a.kind.startsWith("avatar-"));
    return [...fetchedAssets, ...avatars];
  } catch (error) {
    console.warn("Unsplash API fetch failed, falling back to curated assets:", error);
    return fallbackAssets;
  }
}
