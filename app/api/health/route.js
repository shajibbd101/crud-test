import { NextResponse } from "next/server";
import { authColumnReady, endpointInfo, listUsers, storageMode } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health -> verifies the database API connection + auth migration status
export async function GET() {
  try {
    const rows = await listUsers();
    const hasColumn = await authColumnReady();
    return NextResponse.json({
      ok: true,
      ...endpointInfo(),
      rows: rows.length,
      authReady: true,
      passwordStorage: storageMode(hasColumn),
      ...(hasColumn
        ? {}
        : { note: "passwords stored in packed-name mode; run migration SQL for a dedicated column" }),
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
