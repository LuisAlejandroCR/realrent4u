// app/layout.tsx: root layout: fonts, the two stylesheets and the language/as-of preferences provider.
import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../rr/rr.css";
import "../rr/rr-landing.css";
import { PrefsProvider } from "../rr/prefs";

export const metadata: Metadata = {
  title: "Rental Housing Law Navigator",
  description: "Informational lookup of rental housing rules by sample address. Not legal advice.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:wght@400;500;600;700&family=Source+Serif+4:ital,wght@1,400;1,500&display=swap" />
      </head>
      <body style={{ margin: 0 }}>
        <PrefsProvider>{children}</PrefsProvider>
      </body>
    </html>
  );
}
