// layout.tsx: root layout; wraps every page in the data/language providers and the shared shell.
// The shell carries the "not legal advice" banner and the as-of date on every screen.

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { Shell } from "@/components/Shell";

export const metadata: Metadata = {
  title: "Rental Housing Law Navigator",
  description: "Which rental housing rules apply to an address on a date, with citations. Not legal advice.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
