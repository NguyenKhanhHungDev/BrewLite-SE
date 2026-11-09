"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { isObject } from "@/lib/api";
import { parsePaymentStatus, type PaymentStatus } from "@/lib/payments";
import { money } from "@/lib/pricing";
import { ClockIcon, RefreshIcon, ExclamationIcon } from "./Icons";

type Payment = {
  id: number;
  amount: number;
  method: string;
  status: string;
  transactionRef: string | null;
  providerTransactionId: string | null;
  createdAt: string;
  paidAt: string | null;
};

export function PaymentRows({ payments }: { payments: Payment[] }) {
  if (!payments.length) return null;

  return (
    <div className="bl-payment-history-wrap">
      <h3 className="bl-payment-history-title">Lịch sử giao dịch</h3>
      <div className="bl-payment-history-list">
        {payments.map((p) => (
          <article className="bl-payment-record-card" key={p.id}>
            <div className="bl-payment-record-header">
              <span className="bl-payment-record-id">Lần thanh toán #{p.id}</span>
              <span className={`bl-payment-record-badge bl-status-${p.status.toLowerCase()}`}>
                {p.status}
              </span>
            </div>
            <div className="bl-payment-record-details">
              <p className="bl-payment-amount-row">
                <strong>{money(p.amount)}</strong> · <span>{p.method}</span>
              </p>
              {p.status === "RECONCILIATION_REQUIRED" && (
                <p className="bl-reconcile-note">
                  Cần kiểm tra tại quầy; chưa thể kết luận thanh toán thất bại.
                </p>
              )}
              {p.transactionRef && (
                <p className="bl-payment-meta">Mã yêu cầu: <code>{p.transactionRef}</code></p>
              )}
              {p.providerTransactionId && (
                <p className="bl-payment-meta">Mã giao dịch gateway: <code>{p.providerTransactionId}</code></p>
              )}
              <p className="bl-payment-meta">Tạo lúc: {new Date(p.createdAt).toLocaleString("vi-VN")}</p>
              {p.paidAt && (
                <p className="bl-payment-meta bl-paid-at">
                  Thanh toán lúc: {new Date(p.paidAt).toLocaleString("vi-VN")}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function parsePaymentRows(value: unknown): Payment[] {
  if (!Array.isArray(value)) throw new Error("Dữ liệu giao dịch không hợp lệ.");
  return value.map((p) => {
    if (
      !isObject(p) ||
      !Number.isSafeInteger(p.id) ||
      typeof p.amount !== "number" ||
      !Number.isSafeInteger(p.amount) ||
      p.amount < 0 ||
      typeof p.method !== "string" ||
      typeof p.status !== "string" ||
      typeof p.createdAt !== "string" ||
      !Number.isFinite(Date.parse(p.createdAt)) ||
      ![p.transactionRef, p.providerTransactionId, p.paidAt].every(
        (v) => v === null || typeof v === "string",
      )
    )
      throw new Error("Dữ liệu giao dịch không hợp lệ.");
    return p as Payment;
  });
}

export default function PaymentDetails({
  orderId,
  revision = 0,
  onExpired,
  onDeadlineReached,
  onStatus,
}: {
  orderId: number;
  revision?: number;
  onExpired?: () => void;
  onDeadlineReached?: () => void;
  onStatus?: (status: PaymentStatus) => void;
}) {
  const { request } = useAuth();
  const [data, setData] = useState<{
    payments: Payment[];
    deadline: number | null;
    serverTime: number;
    receivedAt: number;
    pending: boolean;
  } | null>(null);
  const expiredDeadline = useRef<number | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [verificationRevision, setVerificationRevision] = useState(0);
  const [verificationError, setVerificationError] = useState(false);

  useEffect(() => {
    if (verificationRevision === 0) return;
    const controller = new AbortController();
    request(`/payments/${orderId}/status`, { signal: controller.signal })
      .then((value) => {
        if (controller.signal.aborted) return;
        const status = parsePaymentStatus(value, orderId);
        onStatus?.(status);
        setVerificationError(false);
        setError("");
        setRetry((v) => v + 1);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setVerificationError(true);
        setError(
          cause instanceof Error
            ? cause.message
            : "Chưa kiểm tra được kết quả backend.",
        );
      });
    return () => controller.abort();
  }, [verificationRevision, orderId, request, onStatus]);

  useEffect(() => {
    const controller = new AbortController();
    request(`/payments/${orderId}/details`, { signal: controller.signal })
      .then((value) => {
        if (
          !isObject(value) ||
          value.orderId !== orderId ||
          typeof value.orderStatus !== "string" ||
          typeof value.serverTime !== "string" ||
          !Number.isFinite(Date.parse(value.serverTime)) ||
          !(
            value.orderExpiresAt === null ||
            (typeof value.orderExpiresAt === "string" &&
              Number.isFinite(Date.parse(value.orderExpiresAt)))
          )
        )
          throw new Error("Dữ liệu hạn thanh toán không hợp lệ.");
        const payments = parsePaymentRows(value.payments);
        if (!controller.signal.aborted) {
          setError("");
          setData({
            payments,
            deadline:
              typeof value.orderExpiresAt === "string"
                ? Date.parse(value.orderExpiresAt)
                : null,
            serverTime: Date.parse(value.serverTime),
            receivedAt: performance.now(),
            pending: value.orderStatus === "PENDING",
          });
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setError(
            e instanceof Error ? e.message : "Không tải được giao dịch.",
          );
      });
    return () => controller.abort();
  }, [request, orderId, revision, retry]);

  useEffect(() => {
    if (!data?.pending || data.deadline === null) return;

    function tick() {
      const remaining = Math.max(
        0,
        Math.ceil(
          (data!.deadline! -
            data!.serverTime -
            (performance.now() - data!.receivedAt)) /
            1000,
        ),
      );
      setNow(remaining);
      if (remaining === 0 && expiredDeadline.current !== data!.deadline) {
        expiredDeadline.current = data!.deadline;
        onDeadlineReached?.();
        if (onExpired) onExpired();
        else setVerificationRevision((v) => v + 1);
      }
    }
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [data, onExpired, onDeadlineReached]);
  return (
    <div className="bl-payment-details-container" aria-label="Thông tin hạn thanh toán và giao dịch">
      {error && (
        <div className="bl-alert bl-alert-error" role="alert">
          <ExclamationIcon size={16} />
          <span>{error}</span>
          <button
            type="button"
            className="bl-text-button"
            style={{ marginLeft: "auto" }}
            onClick={() => {
              if (verificationError) setVerificationRevision((v) => v + 1);
              else setRetry((v) => v + 1);
            }}
          >
            <RefreshIcon size={14} /> Thử lại
          </button>
        </div>
      )}

      {/* Thanh nhỏ hạn thanh toán của hóa đơn với div hiện giờ màu đỏ neon */}
      {data?.pending && data.deadline !== null && now !== null && (
        <div className="bl-invoice-deadline-bar" role="timer" aria-live="polite">
          <div className="bl-deadline-info-wrap">
            <div className="bl-deadline-icon-box" aria-hidden="true">
              <ClockIcon size={20} />
            </div>
            <div>
              <span className="bl-deadline-label">Hạn thanh toán hóa đơn #{orderId}</span>
              <p className="bl-deadline-sublabel">
                {now > 0
                  ? "Vui lòng thanh toán trước khi đơn hàng hết hạn giữ chỗ"
                  : "Hóa đơn đã hết thời gian trên đồng hồ"}
              </p>
            </div>
          </div>
          <div
            className="bl-neon-timer"
            aria-label={`Thời gian còn lại ${Math.floor(now / 60)} phút ${now % 60} giây`}
          >
            {String(Math.floor(now / 60)).padStart(2, "0")}:{String(now % 60).padStart(2, "0")}
          </div>
        </div>
      )}

      {data && <PaymentRows payments={data.payments} />}
    </div>
  );
}
