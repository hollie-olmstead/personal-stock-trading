import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Swing Trader",
  description: "1-5 day swing trade signal scanner",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
