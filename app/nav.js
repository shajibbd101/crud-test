"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Nav() {
  const [user, setUser] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/auth/me", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setUser(d?.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoaded(true));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="nav">
      <Link href="/" className="brand">
          CrudApp
      </Link>
      <div className="nav-links">
        <Link href="/">Users</Link>
        {loaded && user ? (
          <>
            <Link href="/dashboard">Dashboard</Link>
            <span className="nav-user">{user.name}</span>
            <button className="ghost" onClick={logout}>
              Logout
            </button>
          </>
        ) : loaded ? (
          <>
            <Link href="/login">Login</Link>
            <Link href="/register" className="btn-link">
              Register
            </Link>
          </>
        ) : null}
      </div>
    </nav>
  );
}
