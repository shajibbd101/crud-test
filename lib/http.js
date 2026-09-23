import { ApiError } from "@/lib/db";

export function statusOf(err) {
  // Missing migration wins over the generic ApiError status (PostgREST answers 400)
  if (err?.code === "PGRST204" || /password_hash/.test(err?.message || "")) return 503;
  if (err instanceof ApiError) return err.status;
  return 500;
}

export function friendly(err) {
  const msg = err?.message || "Unexpected error";
  if (err?.code === "PGRST204" || /password_hash/.test(msg)) {
    return (
      "The password column is not available yet. Recommended: run " +
      "ALTER TABLE shajibbd ADD COLUMN IF NOT EXISTS password_hash text; " +
      "NOTIFY pgrst, 'reload schema'; (the app keeps working meanwhile)"
    );
  }
  return msg;
}
