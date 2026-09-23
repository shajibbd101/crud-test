import { NextResponse } from "next/server";
import { listUsers } from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/health -> verifies the database API connection
export async function GET() {
  try {
    const rows = await listUsers();
    return NextResponse.json({
      ok: true,
      table: process.env.API_TABLE || "shajibbd",
      rows: rows.length,
    });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
