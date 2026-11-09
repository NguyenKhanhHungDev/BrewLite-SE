"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApiError, isObject, requestJson } from "@/lib/api";
import { parseSession, passwordFitsBcrypt } from "@/lib/session";
import { loginDestination } from "@/lib/login-destination";
import { useAuth } from "./AuthProvider";
import {
  CoffeeIcon,
  SparklesIcon,
  LockIcon,
  MailIcon,
  EyeIcon,
  EyeOffIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  ClockIcon,
  BadgeAwardIcon,
} from "./Icons";

/* Style nằm ngay trong component: không cần file CSS riêng.
   Dùng tiền tố "ba-" nên không đụng tới các class bl-* trong globals. */
const AUTH_STYLES = `
.ba-page {
  --ba-espresso: #2b1a10;
  --ba-espresso-soft: #4a3426;
  --ba-caramel: #b8742a;
  --ba-caramel-deep: #9a5f1e;
  --ba-cream: #fbf7f1;
  --ba-cream-2: #f6f0e8;
  --ba-sand: #ead9c3;
  --ba-line: #e8dccb;
  --ba-muted: #7a6a5c;
  --ba-panel: #ffffff;
  --ba-danger-bg: #fdeeee;
  --ba-danger-fg: #a12a2a;
  --ba-warn-bg: #fff4dd;
  --ba-warn-fg: #8a5a00;
  --ba-ok-bg: #e8f4ea;
  --ba-ok-fg: #2f7d46;
  --ba-ease: cubic-bezier(0.2, 0.7, 0.2, 1);

  position: relative;
  min-height: calc(100vh - 80px);
  display: grid;
  place-items: center;
  padding: clamp(24px, 5vw, 64px) 24px;
  overflow: hidden;
  isolation: isolate;
}

[data-theme="dark"] .ba-page {
  --ba-espresso: #f3e8da;
  --ba-espresso-soft: #e2d2bf;
  --ba-caramel: #e0a15a;
  --ba-caramel-deep: #e0a15a;
  --ba-cream: #2a1f18;
  --ba-cream-2: #2f231b;
  --ba-sand: #3a2b20;
  --ba-line: #4a382b;
  --ba-muted: #b8a898;
  --ba-panel: #211812;
  --ba-danger-bg: #3d1f1f;
  --ba-danger-fg: #ffb4b4;
  --ba-warn-bg: #3b2d12;
  --ba-warn-fg: #ffd58a;
  --ba-ok-bg: #1f3526;
  --ba-ok-fg: #8fd6a4;
}

.ba-glow {
  position: absolute;
  z-index: -1;
  border-radius: 50%;
  filter: blur(80px);
  pointer-events: none;
}
.ba-glow-1 { width: 420px; height: 420px; top: -120px; left: -100px; background: rgba(184, 116, 42, 0.18); }
.ba-glow-2 { width: 380px; height: 380px; right: -100px; bottom: -120px; background: rgba(74, 52, 38, 0.14); }

/* ---------- Card 2 cột ---------- */
.ba-card {
  width: min(1120px, 100%);
  min-height: 700px;
  display: grid;
  grid-template-columns: 1.05fr 1fr;
  background: var(--ba-panel);
  border-radius: 32px;
  overflow: hidden;
  box-shadow: 0 24px 60px -20px rgba(60, 36, 21, 0.25);
}

/* ---------- Cột trái ---------- */
.ba-banner {
  display: flex;
  align-items: center;
  padding: clamp(32px, 5vw, 64px);
  background: linear-gradient(150deg, var(--ba-cream-2) 0%, var(--ba-sand) 100%);
}
.ba-banner-inner { width: 100%; display: grid; gap: 28px; }
.ba-badge {
  justify-self: start;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 9999px;
  background: var(--ba-panel);
  border: 1px solid var(--ba-line);
  color: var(--ba-caramel-deep);
  font-weight: 600;
  font-size: 0.9rem;
}
.ba-title {
  margin: 0;
  color: var(--ba-espresso);
  font-size: clamp(1.9rem, 3.4vw, 2.75rem);
  line-height: 1.18;
  letter-spacing: -0.01em;
}
.ba-title em { color: var(--ba-caramel); font-style: italic; }
.ba-desc { margin: 0; max-width: 46ch; color: var(--ba-espresso-soft); font-size: 1.05rem; line-height: 1.7; }
.ba-perks { display: grid; gap: 22px; margin-top: 4px; }
.ba-perk { display: flex; align-items: flex-start; gap: 16px; }
.ba-perk strong { display: block; color: var(--ba-espresso); font-size: 1.05rem; line-height: 1.3; }
.ba-perk p { margin: 4px 0 0; color: var(--ba-muted); font-size: 0.95rem; line-height: 1.55; }
.ba-perk-icon {
  flex: 0 0 auto;
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--ba-panel);
  color: var(--ba-caramel);
  box-shadow: 0 4px 12px -4px rgba(60, 36, 21, 0.25);
}

/* ---------- Cột phải ---------- */
.ba-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 24px;
  padding: clamp(28px, 4vw, 56px) clamp(24px, 4.5vw, 64px);
  background: var(--ba-panel);
}
.ba-top { display: flex; flex-direction: column; align-items: flex-start; gap: 20px; }
.ba-back {
  display: inline-flex;
  align-items: center;
  padding: 6px 0;
  color: var(--ba-muted);
  font-size: 0.95rem;
  text-decoration: none;
  transition: color 0.2s var(--ba-ease);
}
.ba-back:hover { color: var(--ba-espresso); }

.ba-tabs { display: inline-flex; gap: 6px; padding: 6px; border-radius: 9999px; background: var(--ba-cream-2); }
.ba-tab {
  min-height: 44px;
  padding: 0 22px;
  border: 0;
  border-radius: 9999px;
  background: transparent;
  color: var(--ba-muted);
  font: inherit;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s var(--ba-ease), color 0.2s var(--ba-ease);
}
.ba-tab:hover { color: var(--ba-espresso); }
.ba-tab.active { background: var(--ba-espresso); color: var(--ba-panel); }

/* ---------- Thông báo ---------- */
.ba-alert {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 14px 16px;
  border-radius: 14px;
  font-size: 0.95rem;
  line-height: 1.5;
}
.ba-alert svg { flex: 0 0 auto; margin-top: 2px; }
.ba-alert-warning { background: var(--ba-warn-bg); color: var(--ba-warn-fg); }
.ba-alert-error { background: var(--ba-danger-bg); color: var(--ba-danger-fg); }

/* ---------- Form ---------- */
.ba-form { display: grid; gap: 22px; }
.ba-intro { display: grid; gap: 10px; }
.ba-intro h2 { margin: 0; color: var(--ba-espresso); font-size: clamp(1.6rem, 2.6vw, 2rem); line-height: 1.2; }
.ba-intro p { margin: 0; color: var(--ba-muted); line-height: 1.6; }

.ba-field { display: grid; gap: 8px; }
.ba-label-row { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }
.ba-label { color: var(--ba-espresso); font-weight: 600; font-size: 0.95rem; }
.ba-hint { color: var(--ba-muted); font-size: 0.85rem; }

.ba-input-wrap { position: relative; }
.ba-input-icon {
  position: absolute;
  left: 16px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  color: var(--ba-muted);
  pointer-events: none;
}
.ba-input {
  width: 100%;
  height: 54px;
  padding: 0 16px 0 48px;
  border: 1px solid var(--ba-line);
  border-radius: 14px;
  background: var(--ba-cream);
  color: var(--ba-espresso);
  font: inherit;
  transition: border-color 0.2s var(--ba-ease), box-shadow 0.2s var(--ba-ease), background 0.2s var(--ba-ease);
}
.ba-input::placeholder { color: #a99a8c; }
.ba-input:hover { border-color: #d8c6ae; }
.ba-input:focus {
  outline: none;
  border-color: var(--ba-caramel);
  background: var(--ba-panel);
  box-shadow: 0 0 0 4px rgba(184, 116, 42, 0.18);
}
.ba-input:disabled { opacity: 0.6; cursor: not-allowed; }
.ba-input-pw { padding-right: 56px; }

/* Bỏ nền xanh autofill của Chrome */
.ba-input:-webkit-autofill,
.ba-input:-webkit-autofill:hover,
.ba-input:-webkit-autofill:focus {
  -webkit-box-shadow: 0 0 0 1000px var(--ba-cream) inset;
  -webkit-text-fill-color: var(--ba-espresso);
  caret-color: var(--ba-espresso);
}

.ba-eye {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: var(--ba-muted);
  cursor: pointer;
  transition: background 0.2s var(--ba-ease), color 0.2s var(--ba-ease);
}
.ba-eye:hover { background: var(--ba-cream-2); color: var(--ba-espresso); }

/* ---------- Nút ---------- */
.ba-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  border: 0;
  border-radius: 14px;
  font: inherit;
  font-weight: 700;
  font-size: 1.05rem;
  text-decoration: none;
  cursor: pointer;
  transition: transform 0.2s var(--ba-ease), box-shadow 0.2s var(--ba-ease), background 0.2s var(--ba-ease);
}
.ba-btn-primary { margin-top: 6px; background: var(--ba-espresso); color: var(--ba-panel); }
[data-theme="dark"] .ba-btn-primary { color: #2b1a10; }
.ba-btn-primary:hover:not(:disabled) {
  background: var(--ba-espresso-soft);
  transform: translateY(-1px);
  box-shadow: 0 12px 24px -12px rgba(43, 26, 16, 0.6);
}
.ba-btn-primary:active:not(:disabled) { transform: translateY(0); }
.ba-btn:disabled { opacity: 0.7; cursor: progress; }
.ba-btn-ghost { border: 1px solid var(--ba-line); background: transparent; color: var(--ba-espresso); }
.ba-btn-ghost:hover { background: var(--ba-cream-2); }

.ba-spinner { display: inline-flex; align-items: center; gap: 10px; }
.ba-spinner::before {
  content: "";
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: ba-spin 0.7s linear infinite;
}
@keyframes ba-spin { to { transform: rotate(360deg); } }

.ba-switch { display: flex; justify-content: center; flex-wrap: wrap; gap: 6px; margin-top: 4px; color: var(--ba-muted); font-size: 0.95rem; }
.ba-switch-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ba-caramel-deep);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.ba-switch-link:hover:not(:disabled) { color: var(--ba-espresso); }
.ba-switch-link:disabled { opacity: 0.6; cursor: not-allowed; }

/* ---------- Đã đăng nhập ---------- */
.ba-done { display: grid; justify-items: center; gap: 12px; padding: 8px 0; text-align: center; }
.ba-done-icon {
  width: 72px;
  height: 72px;
  display: grid;
  place-items: center;
  border-radius: 50%;
  background: var(--ba-ok-bg);
  color: var(--ba-ok-fg);
}
.ba-done h2 { margin: 8px 0 0; color: var(--ba-espresso); }
.ba-done p { margin: 0; color: var(--ba-muted); }
.ba-done-actions { width: 100%; display: grid; gap: 12px; margin-top: 16px; }

/* ---------- Focus bàn phím ---------- */
.ba-tab:focus-visible,
.ba-back:focus-visible,
.ba-eye:focus-visible,
.ba-btn:focus-visible,
.ba-switch-link:focus-visible {
  outline: 3px solid rgba(184, 116, 42, 0.55);
  outline-offset: 2px;
}

/* ---------- Responsive ---------- */
@media (max-width: 900px) {
  .ba-card { grid-template-columns: 1fr; min-height: 0; }
  .ba-banner { padding: 28px 24px; }
  .ba-banner-inner { gap: 16px; }
  .ba-desc, .ba-perks { display: none; }
  .ba-title { font-size: 1.7rem; }
}
@media (max-width: 480px) {
  .ba-page { padding: 16px 12px 32px; }
  .ba-card { border-radius: 24px; }
  .ba-tabs { width: 100%; }
  .ba-tab { flex: 1; padding: 0 12px; }
}

@media (prefers-reduced-motion: reduce) {
  .ba-page *, .ba-page *::before, .ba-page *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
  }
}
`;

export default function AuthForm() {
  const router = useRouter();
  const auth = useAuth();
  const params = useSearchParams();
  const requested = params.get("next");

  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function switchMode(toRegister: boolean) {
    setRegister(toRegister);
    setConfirmation("");
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || auth.loading || auth.logoutPending) return;
    if (register && (Array.from(password).length < 8 || !passwordFitsBcrypt(password))) {
      setError("Mật khẩu mới cần ít nhất 8 ký tự và không vượt quá 72 byte UTF-8.");
      return;
    }
    if (register && password !== confirmation) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    setError("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      const body = JSON.stringify({ email: cleanEmail, password });
      const init = {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-brewlite-csrf": "1" },
        body,
      };

      if (register) {
        await requestJson("/api/session/register", init);
      }

      const result = await requestJson("/api/session/login", init);
      const session = parseSession(result);
      const profile = await requestJson("/api/session/proxy/auth/me");
      if (!isObject(profile) || profile.id !== session.userId)
        throw new Error("Không xác nhận được tài khoản đăng nhập. Vui lòng thử lại.");
      const next = loginDestination(profile.role, requested);
      auth.login(result);
      setPassword("");
      router.replace(next);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setError("Email này đã được sử dụng. Vui lòng đăng nhập hoặc dùng email khác.");
      } else if (cause instanceof ApiError && cause.status === 401) {
        setError("Email hoặc mật khẩu không đúng.");
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Có lỗi xảy ra trong quá trình xác thực. Vui lòng thử lại.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="ba-page">
      <style>{AUTH_STYLES}</style>

      <div className="ba-glow ba-glow-1" aria-hidden="true" />
      <div className="ba-glow ba-glow-2" aria-hidden="true" />

      <div className="ba-card">
        {/* Cột trái */}
        <div className="ba-banner">
          <div className="ba-banner-inner">
            <div className="ba-badge">
              <CoffeeIcon size={18} />
              <span>BrewLite Artisan Coffee</span>
            </div>

            <h1 className="ba-title">
              Một ly ngon đậm vị,
              <br />
              <em>khởi đầu ngày hứng khởi.</em>
            </h1>

            <p className="ba-desc">
              Tham gia câu lạc bộ thành viên BrewLite để nhận đặc quyền tích điểm,
              lưu đơn yêu thích và trải nghiệm đặt món không cần chờ tại quầy.
            </p>

            <div className="ba-perks">
              <div className="ba-perk">
                <div className="ba-perk-icon" aria-hidden="true">
                  <BadgeAwardIcon size={18} />
                </div>
                <div>
                  <strong>Tích điểm mỗi ly</strong>
                  <p>Nhận 1 điểm cho mỗi 10.000 VND của đơn đã thanh toán</p>
                </div>
              </div>

              <div className="ba-perk">
                <div className="ba-perk-icon" aria-hidden="true">
                  <ClockIcon size={18} />
                </div>
                <div>
                  <strong>Nhận món nhanh tại quầy</strong>
                  <p>Theo dõi tiến độ pha chế theo thời gian thực</p>
                </div>
              </div>

              <div className="ba-perk">
                <div className="ba-perk-icon" aria-hidden="true">
                  <SparklesIcon size={18} />
                </div>
                <div>
                  <strong>Ưu đãi thành viên</strong>
                  <p>Xem số điểm đã tích lũy trong tài khoản</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cột phải */}
        <div className="ba-panel">
          <div className="ba-top">
            <Link href="/" className="ba-back">
              ← Trở về trang chủ
            </Link>

            <div className="ba-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={!register}
                className={`ba-tab ${!register ? "active" : ""}`}
                onClick={() => switchMode(false)}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={register}
                className={`ba-tab ${register ? "active" : ""}`}
                onClick={() => switchMode(true)}
              >
                Đăng ký mới
              </button>
            </div>
          </div>

          {auth.expired && (
            <div className="ba-alert ba-alert-warning" role="status">
              <ClockIcon size={18} />
              <span>
                Phiên đăng nhập đã hết hạn. Giỏ hàng của bạn vẫn được giữ nguyên an toàn.
              </span>
            </div>
          )}

          {auth.loading || auth.logoutPending ? (
            <p role="status">
              {auth.logoutPending ? "Vui lòng hoàn tất đăng xuất trước khi đăng nhập lại." : "Đang khôi phục phiên đăng nhập…"}
            </p>
          ) : auth.session ? (
            <div className="ba-done">
              <div className="ba-done-icon" aria-hidden="true">
                <CheckCircleIcon size={32} />
              </div>
              <h2>Bạn đã đăng nhập thành công!</h2>
              <p>Tài khoản của bạn đã sẵn sàng để đặt món và tích điểm.</p>
              <div className="ba-done-actions">
                <Link href="/account" className="ba-btn ba-btn-primary">
                  <span>Xem tài khoản</span>
                  <ArrowRightIcon size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => auth.logout()}
                  className="ba-btn ba-btn-ghost"
                >
                  Đăng xuất trên mọi thiết bị
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="ba-form" noValidate>
              <div className="ba-intro">
                <h2>{register ? "Tạo tài khoản mới" : "Chào mừng bạn trở lại"}</h2>
                <p>
                  {register
                    ? "Nhập email và tạo mật khẩu để trở thành hội viên thân thiết."
                    : "Đăng nhập để xem lịch sử đơn hàng và nhận ưu đãi độc quyền."}
                </p>
              </div>

              {error && (
                <div className="ba-alert ba-alert-error" role="alert">
                  <span>{error}</span>
                </div>
              )}

              <div className="ba-field">
                <label className="ba-label" htmlFor="auth-email">
                  Địa chỉ Email
                </label>
                <div className="ba-input-wrap">
                  <span className="ba-input-icon" aria-hidden="true">
                    <MailIcon size={18} />
                  </span>
                  <input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="ban@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={busy}
                    className="ba-input"
                  />
                </div>
              </div>

              <div className="ba-field">
                <div className="ba-label-row">
                  <label className="ba-label" htmlFor="auth-password">
                    Mật khẩu
                  </label>
                  {register && <span className="ba-hint">8 ký tự trở lên, tối đa 72 byte UTF-8</span>}
                </div>
                <div className="ba-input-wrap">
                  <span className="ba-input-icon" aria-hidden="true">
                    <LockIcon size={18} />
                  </span>
                  <input
                    id="auth-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete={register ? "new-password" : "current-password"}
                    required
                    minLength={register ? 8 : 1}
                    placeholder={register ? "Nhập ít nhất 8 ký tự" : "Nhập mật khẩu"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={busy}
                    className="ba-input ba-input-pw"
                  />
                  <button
                    type="button"
                    className="ba-eye"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              {register && (
                <div className="ba-field">
                  <label className="ba-label" htmlFor="auth-confirmation">
                    Xác nhận mật khẩu
                  </label>
                  <div className="ba-input-wrap">
                    <span className="ba-input-icon" aria-hidden="true">
                      <LockIcon size={18} />
                    </span>
                    <input
                      id="auth-confirmation"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      placeholder="Nhập lại mật khẩu"
                      value={confirmation}
                      onChange={(e) => setConfirmation(e.target.value)}
                      disabled={busy}
                      className="ba-input ba-input-pw"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="ba-btn ba-btn-primary"
                disabled={busy}
              >
                {busy ? (
                  <span className="ba-spinner">Đang xử lý...</span>
                ) : (
                  <>
                    <span>{register ? "Đăng ký thành viên" : "Đăng nhập ngay"}</span>
                    <ArrowRightIcon size={18} />
                  </>
                )}
              </button>

              <div className="ba-switch">
                <span>
                  {register ? "Bạn đã có tài khoản?" : "Bạn là khách hàng mới?"}
                </span>
                <button
                  type="button"
                  className="ba-switch-link"
                  disabled={busy}
                  onClick={() => switchMode(!register)}
                >
                  {register ? "Đăng nhập tại đây" : "Đăng ký tài khoản ngay"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
