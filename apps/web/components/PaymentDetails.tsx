"use client";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthProvider";
import { isObject } from "@/lib/api";
import { money } from "@/lib/pricing";

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
  return payments.length ? (
    payments.map((p) => (
      <article className="bl-panel" key={p.id}>
        <h3>Lần thanh toán #{p.id}</h3>
        <p>
          {money(p.amount)} · {p.method}
        </p>
        <p>Trạng thái thanh toán: {p.status}</p>
        {p.status === "RECONCILIATION_REQUIRED" && (
          <p>Cần kiểm tra tại quầy; chưa thể kết luận thanh toán thất bại.</p>
        )}
        <p>Mã yêu cầu: {p.transactionRef ?? "Chưa có"}</p>
        <p>Mã giao dịch gateway: {p.providerTransactionId ?? "Chưa có"}</p>
        <p>Tạo lúc: {new Date(p.createdAt).toLocaleString("vi-VN")}</p>
        {p.paidAt && (
          <p>Thanh toán lúc: {new Date(p.paidAt).toLocaleString("vi-VN")}</p>
        )}
      </article>
    ))
  ) : (
    <p>Chưa có lần thanh toán nào.</p>
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
}: {
  orderId: number;
  revision?: number;
  onExpired?: () => void;
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
        if (onExpired) onExpired();
        else {
          void request(`/payments/${orderId}/status`)
            .then(() => setRetry((v) => v + 1))
            .catch((e) =>
              setError(
                e instanceof Error
                  ? e.message
                  : "Chưa kiểm tra được kết quả backend.",
              ),
            );
        }
      }
    }
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [data, onExpired, request, orderId]);
  return (
    <section aria-label="Thông tin thanh toán">
      <h2>Chi tiết giao dịch</h2>
      {error && (
        <p role="alert">
          {error}{" "}
          <button type="button" onClick={() => setRetry((v) => v + 1)}>
            Thử lại
          </button>
        </p>
      )}
      {!data && !error && <p role="status">Đang tải giao dịch…</p>}
      {data?.pending && data.deadline !== null && now !== null && (
        <p>
          Hạn thanh toán của đơn (không phải hạn gateway):{" "}
          {Math.floor(now / 60)}:{String(now % 60).padStart(2, "0")}.{" "}
          {now === 0 &&
            "Đã hết thời gian trên đồng hồ. Đang chờ kết quả backend; chưa thanh toán lại."}
        </p>
      )}
      {data && <PaymentRows payments={data.payments} />}
    </section>
  );
}
