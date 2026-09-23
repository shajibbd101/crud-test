import { NextResponse } from "next/server";
import { credentialsOf, findUserByEmail, sanitizeUser, upgradeStoredPassword } from "@/lib/db";
import { setSession, verifyPassword } from "@/lib/auth";
import { friendly, statusOf } from "@/lib/http";

export const dynamic = "force-dynamic";

// POST /api/auth/login -> verify credentials and set the session cookie
export async function POST(request) {
  try {
    const body = await request.json();
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password || "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    const user = await findUserByEmail(email);
    const hash = credentialsOf(user);

    // Same message for "no such user" and "wrong password" (no account enumeration)
    if (!hash || !(await verifyPassword(password, hash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // If the migration SQL has since been run, move the hash into the column
    upgradeStoredPassword(user);

    // Mark Secure only when the request actually arrived over HTTPS
    // (Vercel sets x-forwarded-proto; local `next start` is plain http)
    const proto =
      request.headers.get("x-forwarded-proto") ||
      (request.nextUrl?.protocol === "https:" ? "https" : "http");

    await setSession(user, { secure: proto === "https" });
    const safe = sanitizeUser(user);
    return NextResponse.json({
      ok: true,
      user: { id: safe.id, name: safe.name, email: safe.email },
    });
  } catch (err) {
    return NextResponse.json({ error: friendly(err) }, { status: statusOf(err) });
  }
}
