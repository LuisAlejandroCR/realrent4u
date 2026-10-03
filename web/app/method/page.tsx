// page.tsx (method): the one-page method note, docs/METHOD.md rendered to HTML at build time (marked).
// copy-data.mjs copies the file into public/data/; when it is missing the page says so and the build still passes.

import type { Metadata } from "next";
import { MethodNote } from "@/components/MethodNote";
import { readMethodNote } from "@/lib/build-data";

export const metadata: Metadata = { title: "Method note · Rental Housing Law Navigator" };

export default function MethodPage() {
  return <MethodNote html={readMethodNote()} />;
}
