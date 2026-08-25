import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

function serializeError(err: unknown): Record<string, unknown> {
  if (!(err instanceof Error)) {
    return { message: String(err) };
  }
  const anyErr = err as Error & {
    code?: string;
    severity?: string;
    detail?: string;
    cause?: unknown;
  };
  const out: Record<string, unknown> = {
    message: anyErr.message,
    name: anyErr.name,
  };
  if (anyErr.code) out.code = anyErr.code;
  if (anyErr.severity) out.severity = anyErr.severity;
  if (anyErr.detail) out.detail = anyErr.detail;
  if (anyErr.cause) out.cause = serializeError(anyErr.cause);
  return out;
}

export async function GET() {
  try {
    const url = process.env.DATABASE_URL;
    if (!url) {
      return Response.json(
        { ok: false, error: "DATABASE_URL is not set" },
        { status: 500 },
      );
    }

    // Show host only (no password) so we can verify the right URL is loaded
    let host = "unknown";
    try {
      host = new URL(url.replace(/^postgresql:/, "https:")).host;
    } catch {
      host = "(could not parse DATABASE_URL)";
    }

    await db.execute(sql`select 1`);
    return Response.json({ ok: true, host });
  } catch (err) {
    let host = "unknown";
    try {
      const url = process.env.DATABASE_URL ?? "";
      host = new URL(url.replace(/^postgresql:/, "https:")).host;
    } catch {
      /* ignore */
    }
    return Response.json(
      { ok: false, host, error: serializeError(err) },
      { status: 500 },
    );
  }
}
