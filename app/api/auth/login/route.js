import { NextResponse } from "next/server";
import { findUserByEmail } from "@/lib/db";
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
    // Same message for "no such user" and "wrong password" (no account enumeration)
    if (!user?.password_hash || !(await verifyPassword(password, user.password_hash))) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    await setSession(user);
    return NextResponse.json({
      ok: true,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (err) {
    return NextResponse.json({ error: friendly(err) }, { status: statusOf(err) });
  }
}
