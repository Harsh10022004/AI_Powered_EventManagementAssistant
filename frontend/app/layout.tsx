import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Xperience — AI Event Copilot",
  description: "Turn event-planning conversations into a live, risk-aware dashboard.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
