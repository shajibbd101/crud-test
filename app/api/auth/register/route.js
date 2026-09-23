import { NextResponse } from "next/server";
import { createAccount, findUserByEmail } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { friendly, statusOf } from "@/lib/http";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/register -> create an account (user is sent to /login afterwards)
export async function POST(request) {
  try {
    const body = await request.json();
    const name = body?.name?.trim();
    const email = body?.email?.trim().toLowerCase();
    const password = body?.password || "";

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email and password are all required" },
        { status: 400 }
      );
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Please enter a valid email" }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    if (await findUserByEmail(email)) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const user = await createAccount({
      name,
      email,
      password_hash: await hashPassword(password),
    });

    return NextResponse.json(
      { ok: true, id: user.id, name: user.name, email: user.email },
      { status: 201 }
    );
  } catch (err) {
    return NextResponse.json({ error: friendly(err) }, { status: statusOf(err) });
  }
}
