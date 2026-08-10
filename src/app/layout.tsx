import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { BriefSearchProvider } from "@/components/BriefSearchProvider";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SoHired",
  description: "Company research briefs for MBA placement interview preparation",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
        {/*
          Applies the saved theme before first paint, so the page never
          flashes light-then-dark (or vice versa) on load. Kept tiny and
          inline rather than a bundled script so it runs before any
          render — a deferred/bundled version would run after paint,
          which defeats the point.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("theme");if(t==="dark")document.documentElement.setAttribute("data-theme","dark");}catch(e){}`,
          }}
        />
      </head>
      <body className={plusJakartaSans.className}>
        {/*
          impeccable-direction-seed:placement-brief-purple-dashboard-v1
          THESIS: Interview prep as tactile, purple-owned momentum, not another gray SaaS form — refuses the neutral-dashboard default.
          OWN-WORLD: Signature purple (#350859/#4c2470) carries headings, nav, and icons on a true near-white surface; energetic mint marks save/positive states; soft lavender for tags; 24px-radius white cards on soft purple-tinted ambient shadows (resting 0 4px 20px rgba(76,36,112,.06), lifted 0 12px 32px rgba(76,36,112,.12)); Plus Jakarta Sans throughout.
          STORY: A repeat-use MBA candidate mid-placement-season opens the tool, searches or reopens a saved company, and reads a scannable sourced-vs-analysis dashboard before the full prose.
          FIRST VIEWPORT: Home hero — centered elevated search card on a near-white field, heavy purple headline, no eyebrow label.
          FORM: brief-pinned (user-shared Stitch reference project, "SoHired" visual language) — roll skipped per new-work.md, a pinned direction beats the roll.
          FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, and DESIGN.md.
        */}
        <BriefSearchProvider>{children}</BriefSearchProvider>
      </body>
    </html>
  );
}
