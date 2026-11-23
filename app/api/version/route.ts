// The app version this deployment expects. An app that's been open since an older deploy compares its own
// APP_VERSION with this and offers a reload (components/App.tsx, UpdateBar).
import { NextResponse } from "next/server";
import { APP_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ version: APP_VERSION }, { headers: { "Cache-Control": "no-store" } });
}
