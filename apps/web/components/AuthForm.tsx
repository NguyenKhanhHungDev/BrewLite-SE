"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApiError, isObject, requestJson } from "@/lib/api";
import { useAuth } from "./AuthProvider";

export default function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("next") ?? "/";
  const next =
    ["/checkout", "/history", "/cart"].includes(requested) ||
    /^\/confirmation\/\d+$/.test(requested)
      ? requested
      : "/";
  const auth = useAuth();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const body = JSON.stringify({ email: email.trim(), password });
      const init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      };
      if (register) await requestJson("/auth/register", init);
      const result = await requestJson("/auth/login", init);
      if (!isObject(result) || typeof result.accessToken !== "string")
        throw new Error("Dữ liệu đăng nhập không hợp lệ.");
      auth.login(result.accessToken);
      setPassword("");
      router.replace(next);
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? "Email hoặc mật khẩu không đúng."
          : cause instanceof Error
            ? cause.message
            : "Không đăng nhập được.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bl-flow-wrap bl-auth-wrap">
      <section className="bl-auth-visual">
        <p className="bl-eyebrow">BrewLite</p>
        <h2>
          Một ly ngon.
          <br />
          Một ngày dễ chịu.
        </h2>
        <p>Đăng nhập để đặt đồ uống và xem đơn hàng của bạn.</p>
      </section>
      <section className="bl-panel bl-auth-panel">
        <Link href="/" className="bl-detail-back">
          ← Về Menu
        </Link>
        <div className="bl-page-title">
          <h1>{register ? "Đăng ký" : "Đăng nhập"}</h1>
        </div>
        {auth.expired && (
          <p className="bl-alert" role="status">
            Phiên đăng nhập đã hết hạn. Giỏ hàng được giữ nguyên.
          </p>
        )}
        {auth.session ? (
          <>
            <p>Bạn đã đăng nhập.</p>
            <Link href={next} className="bl-button">
              Tiếp tục
            </Link>
          </>
        ) : (
          <form onSubmit={submit}>
            <label className="bl-field">
              Email
              <input
                type="email"
                autoComplete="email"
                required
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={busy}
              />
            </label>
            <label className="bl-field">
              Mật khẩu
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 8 : 1}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={busy}
              />
            </label>
            {register && (
              <p className="bl-muted">Mật khẩu có ít nhất 8 ký tự.</p>
            )}
            {error && (
              <p className="bl-alert bl-alert-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="bl-button bl-full" disabled={busy}>
              {busy
                ? "Đang xử lý..."
                : register
                  ? "Đăng ký và đăng nhập"
                  : "Đăng nhập"}
            </button>
            <button
              type="button"
              className="bl-text-button bl-full"
              disabled={busy}
              onClick={() => {
                setRegister(!register);
                setError("");
              }}
            >
              {register
                ? "Đã có tài khoản? Đăng nhập"
                : "Chưa có tài khoản? Đăng ký"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
