import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { AuraVoiceWidget } from "@/components/AuraVoiceWidget";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"),
  title: "SiteCraft AI",
  description: "Autonomous prompt-to-website generation agent"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="font-sans antialiased">
        <Providers>{children}<AuraVoiceWidget /></Providers>
      </body>
    </html>
  );
}
