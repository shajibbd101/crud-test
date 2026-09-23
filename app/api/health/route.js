import { NextResponse } from "next/server";
import { authColumnReady, endpointInfo, listUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health -> verifies the database API connection + auth migration status
export async function GET() {
  try {
    const rows = await listUsers();
    const authReady = await authColumnReady();
    return NextResponse.json({
      ok: true,
      ...endpointInfo(),
      rows: rows.length,
      authReady,
      ...(authReady ? {} : { note: "password_hash migration SQL not applied yet" }),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
