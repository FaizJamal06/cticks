import { notFound } from "next/navigation";
import BrandHarness from "./BrandHarness";
import "./brand.css";

export const metadata = { title: "cTicks brand (dev only)", robots: { index: false, follow: false } };

/** Mascot + wordmark picker. Local dev and Vercel previews only; production builds 404. */
export default function BrandPage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <BrandHarness />;
}
