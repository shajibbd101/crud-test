import { NextResponse } from "next/server";
import { createUser, listUsers } from "@/lib/db";
import { friendly, statusOf } from "@/lib/http";

export const dynamic = "force-dynamic";

// GET /api/users -> list all users
export async function GET() {
  try {
    const rows = await listUsers();
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json({ error: friendly(err) }, { status: statusOf(err) });
  }
}

// POST /api/users -> create a user
export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email } = body || {};

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "name and email are required" },
        { status: 400 }
      );
    }

    const user = await createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: friendly(err) }, { status: statusOf(err) });
  }
}
