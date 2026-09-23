"use client";

import { useCallback, useEffect, useState } from "react";

const EMPTY_FORM = { name: "", email: "" };

export default function Home() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const notify = (msg, type = "ok") => {
    setError(type === "error" ? msg : "");
    setSuccess(type === "ok" ? msg : "");
    setTimeout(() => {
      setError("");
      setSuccess("");
    }, 3000);
  };

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load users");
      setUsers(data);
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isEdit = editingId !== null;
      const res = await fetch(
        isEdit ? `/api/users/${editingId}` : "/api/users",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");

      notify(isEdit ? "User updated" : "User created");
      setForm(EMPTY_FORM);
      setEditingId(null);
      await fetchUsers();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const onEdit = (user) => {
    setEditingId(user.id);
    setForm({ name: user.name, email: user.email });
    setError("");
    setSuccess("");
  };

  const onCancel = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  const onDelete = async (user) => {
    if (!confirm(`Delete "${user.name}"?`)) return;
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Delete failed");
      notify("User deleted");
      await fetchUsers();
    } catch (err) {
      notify(err.message, "error");
    }
  };

  return (
    <main className="container">
      <h1>Users CRUD</h1>
      <p className="subtitle">
        Next.js API routes + PostgreSQL on api-central_db.shajibbd.online
      </p>

      {error && <div className="message error">{error}</div>}
      {success && <div className="message ok">{success}</div>}

      <section className="card">
        <form onSubmit={onSubmit}>
          <div className="form-row">
            <input
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Add User"}
            </button>
            {editingId && (
              <button type="button" className="ghost" onClick={onCancel}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        {loading ? (
          <p className="muted">Loading…</p>
        ) : users.length === 0 ? (
          <p className="empty">No users yet. Add one above.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td className="muted">
                    {new Date(u.created_at).toLocaleString()}
                  </td>
                  <td>
                    <div className="actions" style={{ justifyContent: "flex-end" }}>
                      <button className="ghost" onClick={() => onEdit(u)}>
                        Edit
                      </button>
                      <button className="danger" onClick={() => onDelete(u)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
