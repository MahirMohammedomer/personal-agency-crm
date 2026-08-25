import { requireAuth } from "@/lib/server/auth";
import { NextResponse } from "next/server";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

export const dynamic = "force-dynamic";

const KEYS = ["customFields", "tagPresets", "prefs"] as const;

const DEFAULTS: Record<string, unknown> = {
  customFields: [],
  tagPresets: [
    "Hot",
    "Construction",
    "Real Estate",
    "Addis",
    "WhatsApp",
    "Called",
    "Interested",
    "Follow-up",
  ],
  prefs: { currency: "ETB", defaultProjectValue: 35000 },
};

export async function GET() {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [...KEYS]));
  const settings: Record<string, unknown> = { ...DEFAULTS };
  for (const row of rows) settings[row.key] = row.value;
  return NextResponse.json({ settings });
}

export async function PUT(request: Request) {
  const unauthorized = await requireAuth();
  if (unauthorized) return unauthorized;
  const body = (await request.json()) as Record<string, unknown>;
  const entries = Object.entries(body).filter(([key]) =>
    (KEYS as readonly string[]).includes(key),
  );
  if (!entries.length) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  for (const [key, value] of entries) {
    await db
      .insert(appSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: appSettings.key,
        set: { value, updatedAt: sql`now()` },
      });
  }

  const rows = await db
    .select()
    .from(appSettings)
    .where(inArray(appSettings.key, [...KEYS]));
  const settings: Record<string, unknown> = { ...DEFAULTS };
  for (const row of rows) settings[row.key] = row.value;
  return NextResponse.json({ settings });
}
