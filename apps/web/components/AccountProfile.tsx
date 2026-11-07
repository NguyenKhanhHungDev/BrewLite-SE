"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "./AuthProvider";
import { isObject } from "@/lib/api";
export default function AccountProfile() {
  const { request } = useAuth();
  const [profile, setProfile] = useState({ email: "", name: "", phone: "" });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    request("/auth/me", { signal: controller.signal })
      .then((value) => {
        if (
          !isObject(value) ||
          typeof value.email !== "string" ||
          !(value.name === null || typeof value.name === "string") ||
          !(value.phone === null || typeof value.phone === "string")
        )
          throw new Error("Hồ sơ không hợp lệ.");
        if (!controller.signal.aborted) {
          setProfile({
            email: value.email,
            name: value.name ?? "",
            phone: value.phone ?? "",
          });
          setLoaded(true);
          setMessage("");
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setMessage(e instanceof Error ? e.message : "Không tải được hồ sơ.");
      });
    return () => controller.abort();
  }, [request, retry]);
  async function save(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      await request("/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: profile.name.trim(),
          phone: profile.phone,
        }),
      });
      setMessage("Đã lưu hồ sơ.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Không lưu được hồ sơ.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="bl-panel">
      <h2>Thông tin cá nhân</h2>
      {message && <p role="status">{message}</p>}
      {!loaded ? (
        <button onClick={() => setRetry((v) => v + 1)}>Tải lại hồ sơ</button>
      ) : (
        <form onSubmit={save}>
          <p>Email: {profile.email}</p>
          <label className="bl-field">
            Họ tên
            <input
              required
              minLength={1}
              maxLength={100}
              autoComplete="name"
              value={profile.name}
              onChange={(e) =>
                setProfile((p) => ({ ...p, name: e.target.value }))
              }
              disabled={busy}
            />
          </label>
          <label className="bl-field">
            Số điện thoại
            <input
              required
              type="tel"
              autoComplete="tel"
              pattern="(0[0-9]{9}|\+84[0-9]{9})"
              title="10 chữ số bắt đầu bằng 0 hoặc +84 và 9 chữ số"
              value={profile.phone}
              onChange={(e) =>
                setProfile((p) => ({ ...p, phone: e.target.value }))
              }
              disabled={busy}
            />
          </label>
          <button className="bl-button" disabled={busy}>
            {busy ? "Đang lưu…" : "Lưu thông tin"}
          </button>
        </form>
      )}
    </section>
  );
}
