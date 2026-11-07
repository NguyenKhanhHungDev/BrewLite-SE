"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ApiError, isObject, requestJson } from "@/lib/api";
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

export default function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("next") ?? "/";
  const next =
    [
      "/checkout",
      "/history",
      "/cart",
      "/admin",
      "/admin/ingredients",
      "/admin/recipes",
      "/admin/orders",
    ].includes(requested) ||
    /^\/confirmation\/\d+$/.test(requested) ||
    /^\/payment\/result\?orderId=[1-9]\d*$/.test(requested)
      ? requested
      : "/";

  const auth = useAuth();
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");

    try {
      const cleanEmail = email.trim().toLowerCase();
      const body = JSON.stringify({ email: cleanEmail, password });
      const init = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      };

      if (register) {
        await requestJson("/auth/register", init);
      }

      const result = await requestJson("/auth/login", init);
      if (!isObject(result) || typeof result.accessToken !== "string") {
        throw new Error("Dữ liệu phản hồi từ máy chủ không hợp lệ.");
      }

      auth.login(result.accessToken);
      setPassword("");
      router.replace(next);
    } catch (cause) {
      if (cause instanceof ApiError) {
        if (cause.status === 401) {
          setError("Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
        } else if (cause.status === 409) {
          setError("Email này đã được đăng ký tài khoản. Vui lòng chuyển sang Đăng nhập.");
        } else if (cause.status === 400) {
          setError("Thông tin không hợp lệ. Email phải đúng định dạng và mật khẩu từ 8 ký tự.");
        } else {
          setError(cause.message || "Lỗi kết nối máy chủ. Vui lòng thử lại sau.");
        }
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("Không thể đăng nhập. Vui lòng thử lại.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="bl-auth-container">
      {/* Background ambient decorative circles */}
      <div className="bl-auth-glow bl-auth-glow-1" aria-hidden="true" />
      <div className="bl-auth-glow bl-auth-glow-2" aria-hidden="true" />

      <div className="bl-auth-card-wrap">
        {/* Left Visual Column */}
        <div className="bl-auth-banner">
          <div className="bl-auth-banner-content">
            <div className="bl-auth-brand-badge">
              <CoffeeIcon size={18} />
              <span>BrewLite Artisan Coffee</span>
            </div>

            <h1 className="bl-auth-banner-title">
              Một ly ngon đậm vị,
              <br />
              <em>khởi đầu ngày hứng khởi.</em>
            </h1>

            <p className="bl-auth-banner-desc">
              Tham gia câu lạc bộ thành viên BrewLite để nhận đặc quyền tích điểm,
              lưu đơn yêu thích và trải nghiệm đặt món không cần chờ tại quầy.
            </p>

            <div className="bl-auth-perks">
              <div className="bl-auth-perk-item">
                <div className="bl-auth-perk-icon" aria-hidden="true">
                  <BadgeAwardIcon size={18} />
                </div>
                <div>
                  <strong>Tích điểm mỗi ly</strong>
                  <p>Nhận 10 điểm cho mỗi 1.000 VND chi tiêu đổi quà hấp dẫn</p>
                </div>
              </div>

              <div className="bl-auth-perk-item">
                <div className="bl-auth-perk-icon" aria-hidden="true">
                  <ClockIcon size={18} />
                </div>
                <div>
                  <strong>Nhận món nhanh tại quầy</strong>
                  <p>Theo dõi tiến độ pha chế theo thời gian thực</p>
                </div>
              </div>

              <div className="bl-auth-perk-item">
                <div className="bl-auth-perk-icon" aria-hidden="true">
                  <SparklesIcon size={18} />
                </div>
                <div>
                  <strong>Ưu đãi thành viên</strong>
                  <p>Nhận mã giảm giá và trải nghiệm các hương vị mùa mới</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Card */}
        <div className="bl-auth-form-card">
          <div className="bl-auth-card-header">
            <Link href="/" className="bl-auth-back-link">
              <span aria-hidden="true">←</span> Về thực đơn
            </Link>

            <div className="bl-auth-mode-switch" role="tablist" aria-label="Lựa chọn thao tác">
              <button
                type="button"
                role="tab"
                aria-selected={!register}
                className={`bl-auth-tab ${!register ? "active" : ""}`}
                onClick={() => {
                  setRegister(false);
                  setError("");
                }}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={register}
                className={`bl-auth-tab ${register ? "active" : ""}`}
                onClick={() => {
                  setRegister(true);
                  setError("");
                }}
              >
                Đăng ký mới
              </button>
            </div>
          </div>

          {auth.expired && (
            <div className="bl-auth-alert bl-auth-alert-warning" role="status">
              <ClockIcon size={18} />
              <span>Phiên đăng nhập đã hết hạn. Giỏ hàng của bạn vẫn được giữ nguyên an toàn.</span>
            </div>
          )}

          {auth.session ? (
            <div className="bl-auth-logged-box">
              <div className="bl-auth-logged-icon" aria-hidden="true">
                <CheckCircleIcon size={32} />
              </div>
              <h2>Bạn đã đăng nhập thành công!</h2>
              <p>Tài khoản của bạn đã sẵn sàng để đặt món và tích điểm.</p>
              <div className="bl-auth-logged-actions">
                <Link href={next} className="bl-button bl-button-primary bl-full">
                  <span>Tiếp tục đặt món</span>
                  <ArrowRightIcon size={16} />
                </Link>
                <button
                  type="button"
                  onClick={() => auth.logout()}
                  className="bl-button bl-button-ghost bl-full"
                >
                  Đăng xuất tài khoản
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={submit} className="bl-auth-form" noValidate>
              <div className="bl-auth-form-intro">
                <h2>{register ? "Tạo tài khoản mới" : "Chào mừng bạn trở lại"}</h2>
                <p>
                  {register
                    ? "Nhập email và tạo mật khẩu để trở thành hội viên thân thiết."
                    : "Đăng nhập để xem lịch sử đơn hàng và nhận ưu đãi độc quyền."}
                </p>
              </div>

              {error && (
                <div className="bl-auth-alert bl-auth-alert-error" role="alert">
                  <span>{error}</span>
                </div>
              )}

              <div className="bl-auth-field-group">
                <label className="bl-auth-label" htmlFor="auth-email">
                  Địa chỉ Email
                </label>
                <div className="bl-auth-input-wrap">
                  <span className="bl-auth-input-icon" aria-hidden="true">
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
                    className="bl-auth-input"
                  />
                </div>
              </div>

              <div className="bl-auth-field-group">
                <div className="bl-auth-label-row">
                  <label className="bl-auth-label" htmlFor="auth-password">
                    Mật khẩu
                  </label>
                  {register && (
                    <span className="bl-auth-label-hint">Tối thiểu 8 ký tự</span>
                  )}
                </div>
                <div className="bl-auth-input-wrap">
                  <span className="bl-auth-input-icon" aria-hidden="true">
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
                    className="bl-auth-input bl-auth-input-password"
                  />
                  <button
                    type="button"
                    className="bl-auth-password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOffIcon size={18} /> : <EyeIcon size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="bl-button bl-button-primary bl-auth-submit-btn"
                disabled={busy}
              >
                {busy ? (
                  <span className="bl-auth-btn-spinner">Đang xử lý...</span>
                ) : (
                  <>
                    <span>{register ? "Đăng ký thành viên" : "Đăng nhập ngay"}</span>
                    <ArrowRightIcon size={18} />
                  </>
                )}
              </button>

              <div className="bl-auth-switch-prompt">
                <span>
                  {register ? "Bạn đã có tài khoản?" : "Bạn là khách hàng mới?"}
                </span>
                <button
                  type="button"
                  className="bl-auth-switch-link"
                  disabled={busy}
                  onClick={() => {
                    setRegister(!register);
                    setError("");
                  }}
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
