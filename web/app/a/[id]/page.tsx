// page.tsx (a/[id]): one static page per sample address, /a/A0016/, generated from public/data/addresses.json.
// The body is client-side (AddressView) because the as-of date and language live in the client context.

import type { Metadata } from "next";
import { AddressView } from "@/components/AddressView";
import { readAddresses } from "@/lib/build-data";

// Static export: only the ids listed below exist; anything else is the host's 404.
export const dynamicParams = false;

// The starter pack always has addresses; the placeholder only keeps `output: "export"` building if the CSV is gone.
export function generateStaticParams(): { id: string }[] {
  const ids = readAddresses().map((a) => ({ id: a.address_id }));
  return ids.length ? ids : [{ id: "none" }];
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const a = readAddresses().find((r) => r.address_id === id);
  const where = a ? ` · ${a.street_address}, ${a.postal_city}, ${a.state}` : "";
  return { title: `${id}${where} · Rental Housing Law Navigator` };
}

export default async function AddressPage({ params }: Props) {
  const { id } = await params;
  return <AddressView id={id} />;
}
