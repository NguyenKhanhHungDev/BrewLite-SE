"use client";

import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { money } from "@/lib/pricing";
import { parsePaymentHistory, type PaymentAttempt } from "@/lib/payments";

const statusBadgeClass: Record<string, string> = {
  SUCCESS: "bl-status-paid",
  PENDING: "bl-status",
  FAILED: "bl-status-error",
  CANCELLED: "bl-status-muted",
  RECONCILIATION_REQUIRED: "bl-status-warning",
};

const statusLabels: Record<string, string> = {
  SUCCESS: "Thành công",
  PENDING: "Đang chờ",
  FAILED: "Thất bại",
  CANCELLED: "Đã hủy",
  RECONCILIATION_REQUIRED: "Cần đối soát",
};

export default function PaymentHistory({ orderId }: { orderId: number }) {
  const { request } = useAuth();
  const [attempts, setAttempts] = useState<PaymentAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await request(`/payments/${orderId}/history`);
        if (active) {
          setAttempts(parsePaymentHistory(res));
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Không tải được lịch sử giao dịch",
          );
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (open) {
      void load();
    }

    return () => {
      active = false;
    };
  }, [orderId, open, request]);

  return (
    <div style={{ marginTop: "1rem" }}>
      <button
        type="button"
        className="bl-button bl-button-secondary"
        onClick={() => setOpen((prev) => !prev)}
        style={{ width: "100%", fontSize: "0.9rem" }}
      >
        {open ? "Ẩn chi tiết giao dịch ▲" : "Xem chi tiết các lần thử thanh toán ▼"}
      </button>

      {open && (
        <div
          style={{
            marginTop: "0.75rem",
            padding: "0.75rem",
            border: "1px solid #e5e7eb",
            borderRadius: "8px",
            backgroundColor: "#f9fafb",
          }}
        >
          <h3 style={{ fontSize: "1rem", marginBottom: "0.5rem" }}>
            Chi tiết giao dịch đơn #{orderId}
          </h3>

          {loading && <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Đang tải lịch sử giao dịch...</p>}
          {error && <p style={{ fontSize: "0.875rem", color: "#dc2626" }}>{error}</p>}

          {!loading && !error && attempts.length === 0 && (
            <p style={{ fontSize: "0.875rem", color: "#6b7280" }}>Chưa có lần thử thanh toán nào được ghi nhận.</p>
          )}

          {!loading && !error && attempts.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {attempts.map((item, idx) => (
                <div
                  key={item.paymentId}
                  style={{
                    padding: "0.75rem",
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: "6px",
                    fontSize: "0.875rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "0.35rem",
                    }}
                  >
                    <strong>
                      Lần thử #{attempts.length - idx} (Mã GD #{item.paymentId})
                    </strong>
                    <span
                      className={`bl-status ${statusBadgeClass[item.status] ?? ""}`}
                    >
                      {statusLabels[item.status] ?? item.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.25rem", color: "#4b5563" }}>
                    <div>
                      <span>Số tiền: </span>
                      <strong>{money(item.amount)}</strong>
                    </div>
                    <div>
                      <span>Cổng: </span>
                      <span>{item.provider}</span>
                    </div>
                    <div>
                      <span>Khởi tạo: </span>
                      <span>{new Date(item.createdAt).toLocaleString("vi-VN")}</span>
                    </div>
                    {item.paidAt && (
                      <div>
                        <span>Thanh toán lúc: </span>
                        <span>{new Date(item.paidAt).toLocaleString("vi-VN")}</span>
                      </div>
                    )}
                  </div>

                  {item.transactionRef && (
                    <div style={{ marginTop: "0.35rem", wordBreak: "break-all", color: "#6b7280", fontSize: "0.8rem" }}>
                      Mã tham chiếu: <code>{item.transactionRef}</code>
                    </div>
                  )}
                  {item.providerTransactionId && (
                    <div style={{ marginTop: "0.2rem", wordBreak: "break-all", color: "#6b7280", fontSize: "0.8rem" }}>
                      Mã ZaloPay: <code>{item.providerTransactionId}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
