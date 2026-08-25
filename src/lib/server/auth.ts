import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings, owner } from "@/db/schema";

export const SESSION_COOKIE = "meda_session";
const SESSION_SECRET_KEY = "sessionSecret";

/** Persisted signing secret so sessions survive restarts without a env var. */
async function sessionSecret(): Promise<string> {
  const envSecret = process.env.AUTH_SECRET;
  if (envSecret) return envSecret;

  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, SESSION_SECRET_KEY));
  if (row?.value && typeof row.value === "string") return row.value;

  const generated = randomBytes(32).toString("hex");
  await db
    .insert(appSettings)
    .values({ key: SESSION_SECRET_KEY, value: generated })
    .onConflictDoNothing();
  const [saved] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, SESSION_SECRET_KEY));
  return typeof saved?.value === "string" ? saved.value : generated;
}

/* ------------------------------- passwords ------------------------------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, digest] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !digest) return false;
  const derived = scryptSync(password, salt, 64);
  const expected = Buffer.from(digest, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

/* -------------------------------- sessions -------------------------------- */

type SessionPayload = { sub: number; email: string; exp: number };

export async function createSessionToken(
  ownerId: number,
  email: string,
  remember: boolean,
): Promise<{ token: string; maxAge: number }> {
  const maxAge = remember ? 60 * 60 * 24 * 90 : 60 * 60 * 12;
  const payload: SessionPayload = {
    sub: ownerId,
    email,
    exp: Date.now() + maxAge * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const secret = await sessionSecret();
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return { token: `${body}.${sig}`, maxAge };
}

export async function readSessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const secret = await sessionSecret();
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  if (sig.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return readSessionToken(store.get(SESSION_COOKIE)?.value);
}

/* ------------------------------ owner account ----------------------------- */

/**
 * Exactly one owner account exists. On first run it is created from
 * OWNER_EMAIL / OWNER_PASSWORD environment variables.
 */
export async function ensureOwner() {
  const [existing] = await db.select().from(owner).limit(1);
  if (existing) return existing;

  const email = (process.env.OWNER_EMAIL ?? "").toLowerCase().trim();
  const password = process.env.OWNER_PASSWORD ?? "";
  if (!email || !password) {
    throw new Error("OWNER_EMAIL and OWNER_PASSWORD environment variables are required on first run");
  }
  const [created] = await db
    .insert(owner)
    .values({ email, passwordHash: hashPassword(password) })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [fallback] = await db.select().from(owner).limit(1);
  return fallback;
}

export async function getOwner() {
  const [row] = await db.select().from(owner).limit(1);
  return row ?? null;
}

/** Guard for API routes. Returns null when authenticated, else a 401 Response. */
export async function requireAuth(): Promise<Response | null> {
  const session = await getSession();
  if (session) return null;
  return new Response(JSON.stringify({ error: "Not authenticated" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
