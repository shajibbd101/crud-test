import { NextResponse } from "next/server";
import { deleteUser, getUser, isValidId, updateUser } from "@/lib/db";
import { friendly, statusOf } from "@/lib/http";

export const dynamic = "force-dynamic";

async function idFromParams(params) {
  const { id: rawId } = await params;
  return Number(rawId);
}

// GET /api/users/:id
export async function GET(_request, { params }) {
  const id = await idFromParams(params);
  if (!isValidId(id))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    return NextResponse.json(await getUser(id));
  } catch (err) {
    return NextResponse.json({ error: friendly(err) }, { status: statusOf(err) });
  }
}

// PUT /api/users/:id -> update
export async function PUT(request, { params }) {
  const id = await idFromParams(params);
  if (!isValidId(id))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const body = await request.json();
    const { name, email } = body || {};
    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json(
        { error: "name and email are required" },
        { status: 400 }
      );
    }

    const user = await updateUser(id, {
      name: name.trim(),
      email: email.trim().toLowerCase(),
    });
    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: friendly(err) }, { status: statusOf(err) });
  }
}

// DELETE /api/users/:id
export async function DELETE(_request, { params }) {
  const id = await idFromParams(params);
  if (!isValidId(id))
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });

  try {
    const user = await deleteUser(id);
    return NextResponse.json({ ok: true, id: user.id });
  } catch (err) {
    return NextResponse.json({ error: friendly(err) }, { status: statusOf(err) });
  }
}
