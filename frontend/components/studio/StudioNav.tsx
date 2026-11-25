"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, Sparkles, X } from "lucide-react";
import { useState } from "react";

export function StudioNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <header className="sc-nav">
      <div className="sc-nav-inner">
        <Link href="/" className="sc-logo">
          <span>
            <Sparkles size={20} />
          </span>
          SiteCraft <b>AI</b>
        </Link>
        <nav
          className={open ? "sc-nav-links is-open" : "sc-nav-links"}
          aria-label="Main navigation"
        >
          {[
            ["/templates", "Templates"],
            ["/showcase", "Showcase"],
            ["/playground", "Interactive demo"],
          ].map(([href, text]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={pathname === href ? "page" : undefined}
            >
              {text}
            </Link>
          ))}
        </nav>
        <div className="sc-nav-actions">
          <Link href="/login" className="sc-nav-login">
            Log in
          </Link>
          <Link href="/dashboard" className="sc-btn sc-btn-dark sc-btn-sm">
            Start creating <Sparkles size={15} />
          </Link>
          <button
            className="sc-mobile-menu"
            aria-label="Toggle navigation"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
    </header>
  );
}
