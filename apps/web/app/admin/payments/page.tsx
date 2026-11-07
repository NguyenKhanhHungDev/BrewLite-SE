"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { PaymentRows, parsePaymentRows } from "@/components/PaymentDetails";
import { isObject } from "@/lib/api";
export default function ReconciliationPage() {
  const { request } = useAuth();
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    rows: ReturnType<typeof parsePaymentRows>;
    orders: { id: number; status: string }[];
    total: number;
    error: string;
    loading: boolean;
  }>({ rows: [], orders: [], total: 0, error: "", loading: true });
  useEffect(() => {
    const controller = new AbortController();
    request(`/payments/admin/reconciliation?page=${page}`, {
      signal: controller.signal,
    })
      .then((value) => {
        if (
          !isObject(value) ||
          !Number.isSafeInteger(value.total) ||
          !Array.isArray(value.payments)
        )
          throw new Error("Dữ liệu đối soát không hợp lệ.");
        const rows = parsePaymentRows(value.payments);
        const orders = value.payments.map((p) => {
          if (
            !isObject(p) ||
            !isObject(p.order) ||
            !Number.isSafeInteger(p.order.id) ||
            typeof p.order.status !== "string"
          )
            throw new Error("Đơn hàng không hợp lệ.");
          return { id: Number(p.order.id), status: p.order.status };
        });
        if (!controller.signal.aborted)
          setState({
            rows,
            orders,
            total: Number(value.total),
            error: "",
            loading: false,
          });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState({
            rows: [],
            orders: [],
            total: 0,
            error: e instanceof Error ? e.message : "Không tải được danh sách.",
            loading: false,
          });
      });
    return () => controller.abort();
  }, [page, retry, request]);
  function reload(nextPage: number) {
    setState((s) => ({ ...s, loading: true, error: "" }));
    setPage(nextPage);
    setRetry((v) => v + 1);
  }
  return (
    <section>
      <h1>Giao dịch cần đối soát</h1>
      <p>
        Bộ lọc: RECONCILIATION_REQUIRED. Cần kiểm tra, chưa thể kết luận thất
        bại.
      </p>
      <button disabled={state.loading} onClick={() => reload(page)}>
        Làm mới
      </button>
      {state.loading ? (
        <p role="status">Đang tải…</p>
      ) : state.error ? (
        <p role="alert">{state.error}</p>
      ) : (
        <>
          <p>{state.total} giao dịch</p>
          {!state.rows.length && <p>Không có giao dịch cần đối soát.</p>}
          {state.rows.map((row, i) => (
            <div key={row.id}>
              <Link href="/admin/orders">Đơn #{state.orders[i].id}</Link>
              <p>Trạng thái đơn: {state.orders[i].status}</p>
              <PaymentRows payments={[row]} />
            </div>
          ))}
          <button disabled={page === 1} onClick={() => reload(page - 1)}>
            Trang trước
          </button>
          <span> Trang {page} </span>
          <button
            disabled={page * 20 >= state.total}
            onClick={() => reload(page + 1)}
          >
            Trang sau
          </button>
        </>
      )}
    </section>
  );
}
