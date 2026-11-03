"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import PaymentResult from "@/components/PaymentResult";
import { useAuth } from "@/components/AuthProvider";
import { parseOrderId } from "@/lib/payments";

function ResultPage() {
  const params = useSearchParams();
  const { session } = useAuth();
  const orderId =
    params.getAll("orderId").length === 1
      ? parseOrderId(params.get("orderId"))
      : null;
  return (
    <main className="bl-flow-wrap">
      <Link href="/history" className="bl-detail-back">
        ← Lịch sử đơn hàng
      </Link>
      <div className="bl-page-title">
        <p className="bl-eyebrow">Nhận tại quầy</p>
        <h1>Kết quả thanh toán</h1>
      </div>
      {!orderId ? (
        <section className="bl-panel">
          <h2>Không tìm thấy mã đơn</h2>
          <Link href="/history" className="bl-button">
            Xem lịch sử đơn hàng
          </Link>
        </section>
      ) : !session ? (
        <section className="bl-panel">
          <h2>Đăng nhập để xem kết quả</h2>
          <Link
            href={`/login?next=${encodeURIComponent(`/payment/result?orderId=${orderId}`)}`}
            className="bl-button"
          >
            Đăng nhập
          </Link>
        </section>
      ) : (
        <PaymentResult key={`${session.userId}:${orderId}`} orderId={orderId} />
      )}
    </main>
  );
}

export default function PaymentResultPage() {
  return (
    <Suspense
      fallback={
        <main className="bl-flow-wrap">
          <p role="status">Đang tải...</p>
        </main>
      }
    >
      <ResultPage />
    </Suspense>
  );
}
