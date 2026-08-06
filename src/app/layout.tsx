import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Placement Brief",
  description: "Company research briefs for MBA placement interview preparation",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
