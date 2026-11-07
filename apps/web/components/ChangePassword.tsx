"use client";
import { useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import PasswordField from "./PasswordField";
export default function ChangePassword() {
  const { request, logout } = useAuth();
  const [currentPassword, setCurrent] = useState("");
  const [newPassword, setNew] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (newPassword !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await request("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword, confirmation }),
      });
      setCurrent("");
      setNew("");
      setConfirmation("");
      logout();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không đổi được mật khẩu.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="bl-panel">
      <h2>Đổi mật khẩu</h2>
      <p>
        Sau khi đổi thành công, đăng nhập lại bằng mật khẩu mới. Mọi phiên đăng
        nhập cũ sẽ bị thu hồi.
      </p>
      <form onSubmit={submit}>
        <PasswordField
          label="Mật khẩu hiện tại"
          value={currentPassword}
          onChange={setCurrent}
          minLength={1}
          autoComplete="current-password"
          disabled={busy}
        />
        <PasswordField
          label="Mật khẩu mới"
          value={newPassword}
          onChange={setNew}
          disabled={busy}
        />
        <PasswordField
          label="Xác nhận mật khẩu mới"
          value={confirmation}
          onChange={setConfirmation}
          disabled={busy}
        />
        {error && <p role="alert">{error}</p>}
        <button className="bl-button" disabled={busy}>
          {busy ? "Đang xử lý…" : "Đổi mật khẩu"}
        </button>
      </form>
    </section>
  );
}
