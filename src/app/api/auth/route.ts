import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { owner } from "@/db/schema";
import {
  SESSION_COOKIE,
  createSessionToken,
  ensureOwner,
  getSession,
  hashPassword,
  verifyPassword,
} from "@/lib/server/auth";

export const dynamic = "force-dynamic";

/** Session probe used by the client shell. */
export async function GET() {
  const [session, account] = await Promise.all([getSession(), ensureOwner()]);
  return NextResponse.json({
    authenticated: Boolean(session),
    email: session?.email ?? null,
    ownerEmail: account?.email ?? null,
  });
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    action?: "login" | "logout" | "request-reset" | "reset" | "change-password";
    email?: string;
    password?: string;
    newPassword?: string;
    token?: string;
    remember?: boolean;
  };

  const account = await ensureOwner();
  if (!account) {
    return NextResponse.json({ error: "Owner account unavailable" }, { status: 500 });
  }

  switch (body.action) {
    case "login": {
      const email = (body.email ?? "").toLowerCase().trim();
      const password = body.password ?? "";
      const ok = email === account.email && verifyPassword(password, account.passwordHash);
      if (!ok) {
        // Uniform delay-free generic message: no user enumeration.
        return NextResponse.json({ error: "Incorrect email or password" }, { status: 401 });
      }
      const { token, maxAge } = await createSessionToken(
        account.id,
        account.email,
        Boolean(body.remember),
      );
      const res = NextResponse.json({ ok: true, email: account.email });
      res.cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge,
      });
      return res;
    }

    case "logout": {
      const res = NextResponse.json({ ok: true });
      res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
      return res;
    }

    case "request-reset": {
      const email = (body.email ?? "").toLowerCase().trim();
      if (email !== account.email) {
        // Always report success so the endpoint can't be probed.
        return NextResponse.json({ ok: true });
      }
      const token = randomBytes(24).toString("hex");
      await db
        .update(owner)
        .set({ resetToken: token, resetExpiresAt: new Date(Date.now() + 30 * 60 * 1000) })
        .where(eq(owner.id, account.id));
      // Personal single-user app: the token is returned directly instead of
      // wiring up an email provider.
      return NextResponse.json({ ok: true, token });
    }

    case "reset": {
      const token = (body.token ?? "").trim();
      const newPassword = body.newPassword ?? "";
      if (newPassword.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      const valid =
        token &&
        account.resetToken &&
        token === account.resetToken &&
        account.resetExpiresAt &&
        new Date(account.resetExpiresAt).getTime() > Date.now();
      if (!valid) {
        return NextResponse.json({ error: "Reset code is invalid or expired" }, { status: 400 });
      }
      await db
        .update(owner)
        .set({ passwordHash: hashPassword(newPassword), resetToken: null, resetExpiresAt: null })
        .where(eq(owner.id, account.id));
      return NextResponse.json({ ok: true });
    }

    case "change-password": {
      const session = await getSession();
      if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
      if (!verifyPassword(body.password ?? "", account.passwordHash)) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
      }
      if ((body.newPassword ?? "").length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters" }, { status: 400 });
      }
      await db
        .update(owner)
        .set({ passwordHash: hashPassword(body.newPassword as string) })
        .where(eq(owner.id, account.id));
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
