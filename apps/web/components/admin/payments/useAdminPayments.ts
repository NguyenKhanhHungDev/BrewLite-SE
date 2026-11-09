"use client";
import { useAuth } from "@/components/AuthProvider";
import { parsePaymentRows } from "@/components/PaymentDetails";
import { useAdminList } from "@/components/admin/useAdminList";
import {
  parseAdminPayment,
  parseAdminPaymentPage,
  type AdminPayment,
} from "@/lib/admin-payments";
import { ApiError, isObject } from "@/lib/api";
import { useRef, useState, type FormEvent } from "react";
import { defaults } from "./payments-config";
/** State, API calls and mutation rules for the payments screen. */
export function useAdminPayments() {
  const { request } = useAuth();
  const [filters, setFilters] = useState(defaults),
    [applied, setApplied] = useState(defaults);
  const [page, setPage] = useState(1),
    [limit, setLimit] = useState(20);
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    status: applied.status,
  });
  if (applied.search) query.set("search", applied.search);
  if (applied.dateFrom) query.set("dateFrom", applied.dateFrom);
  if (applied.dateTo) query.set("dateTo", applied.dateTo);
  const list = useAdminList(
    `/payments/admin/transactions?${query}`,
    parseAdminPaymentPage,
  );
  const [selected, setSelected] = useState<AdminPayment | null>(null),
    [note, setNote] = useState("");
  const [busy, setBusy] = useState(false),
    [loadingDetail, setLoadingDetail] = useState(false);
  const [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const detailVersion = useRef(0);
  async function open(id: number) {
    const version = ++detailVersion.current;
    setLoadingDetail(true);
    setError("");
    setSelected(null);
    try {
      const value = parseAdminPayment(
        await request(`/payments/admin/transactions/${id}`),
      );
      if (!value.order.payments)
        throw new Error("Thiếu lịch sử giao dịch của đơn.");
      parsePaymentRows(value.order.payments);
      if (version === detailVersion.current) {
        setSelected(value);
        setNote(value.adminNote ?? "");
      }
    } catch (cause) {
      if (version === detailVersion.current)
        setError(
          cause instanceof Error ? cause.message : "Không tải được chi tiết.",
        );
    } finally {
      if (version === detailVersion.current) setLoadingDetail(false);
    }
  }
  function apply(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (
      filters.dateFrom &&
      filters.dateTo &&
      filters.dateFrom > filters.dateTo
    ) {
      setError("Ngày bắt đầu không được sau ngày kết thúc.");
      return;
    }
    setApplied({ ...filters, search: filters.search.trim() });
    setPage(1);
  }
  async function saveNote(event: FormEvent) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = parseAdminPayment(
        await request(`/payments/admin/transactions/${selected.id}/note`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note }),
        }),
      );
      setSelected(result);
      setNote(result.adminNote ?? "");
      setMessage(
        "Đã lưu ghi chú quản trị. Trạng thái tài chính không thay đổi.",
      );
      list.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không lưu được ghi chú.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function recheck() {
    if (
      !selected ||
      busy ||
      !window.confirm(
        `Truy vấn ZaloPay cho giao dịch #${selected.id}? Kết quả xác minh có thể cập nhật trạng thái qua quy trình thanh toán.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await request(
        `/payments/admin/transactions/${selected.id}/recheck`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        },
      );
      if (
        !isObject(result) ||
        typeof result.message !== "string" ||
        !["SETTLED", "PENDING", "MANUAL_RESOLUTION_REQUIRED"].includes(
          String(result.result),
        )
      )
        throw new Error(
          "Kết quả kiểm tra không hợp lệ. Vui lòng tải lại chi tiết.",
        );
      const payment = parseAdminPayment(result.payment);
      setSelected(payment);
      setNote(payment.adminNote ?? "");
      setMessage(result.message);
      list.reload();
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 503
          ? "Chưa kiểm tra được ZaloPay: cấu hình hoặc gateway chưa sẵn sàng. Chưa có kết quả xác minh; hãy tải lại chi tiết trước khi thử tiếp."
          : cause instanceof Error
            ? cause.message
            : "Không kiểm tra được gateway.",
      );
      list.reload();
    } finally {
      setBusy(false);
    }
  }
  function closeDetail() {
    ++detailVersion.current;
    setSelected(null);
  }

  return {
    filters,
    setFilters,
    setApplied,
    page,
    setPage,
    limit,
    setLimit,
    list,
    selected,
    note,
    setNote,
    busy,
    loadingDetail,
    error,
    setError,
    message,
    setMessage,
    open,
    apply,
    saveNote,
    recheck,
    closeDetail,
  };
}
export type PaymentsModel = ReturnType<typeof useAdminPayments>;
