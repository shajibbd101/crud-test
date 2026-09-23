"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 401) {
          router.replace("/login");
          return;
        }
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || "Failed to load account");
        setUser(data.user);
        setStatus("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setError(err.message);
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  if (status === "loading") {
    return (
      <main className="container narrow">
        <p className="muted">Loading your account…</p>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="container narrow">
        <div className="message error">{error}</div>
        <p className="center">
          <Link href="/login">Go to login</Link>
        </p>
      </main>
    );
  }

  if (!user) return null;

  const initials = user.name
    .split(/\s+/)
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const joined = user.created_at
    ? new Date(user.created_at).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <main className="container narrow">
      <div className="welcome">
        <div className="avatar">{initials}</div>
        <div>
          <h1>
            {greeting}, {user.name.split(" ")[0]} 👋
          </h1>
          <p className="subtitle" style={{ marginBottom: 0 }}>
            You are logged in. Here is your account information.
          </p>
        </div>
      </div>

      <section className="card">
        <h2 className="card-title">Your information</h2>
        <dl className="info-list">
          <div>
            <dt>User ID</dt>
            <dd>#{user.id}</dd>
          </div>
          <div>
            <dt>Name</dt>
            <dd>{user.name}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Member since</dt>
            <dd>{joined}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className="badge">Active session</span>
            </dd>
          </div>
        </dl>
      </section>

      <div className="row-actions">
        <Link href="/" className="ghost button-link">
          Manage users
        </Link>
        <button className="danger" onClick={logout}>
          Logout
        </button>
      </div>
    </main>
  );
}
