import { NextResponse } from "next/server";
import { ApiError, deleteUser, getUser, isValidId, updateUser } from "@/lib/db";

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
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
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
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
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
    const status = err instanceof ApiError ? err.status : 500;
    return NextResponse.json({ error: err.message }, { status });
  }
}
