"use client";
import { useAuth } from "@/components/AuthProvider";
import { useAdminList } from "@/components/admin/useAdminList";
import {
  parseAdminOrder,
  parseAdminOrders,
  type AdminOrder,
} from "@/lib/admin-orders";
import { statusNames, type OrderStatus } from "@/lib/orders";
import { useCallback, useEffect, useRef, useState } from "react";
import { nextProgress } from "./orders-config";
/** State, API calls and mutation rules for the orders screen. */
export function useAdminOrders() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [applied, setApplied] = useState({
    dateFrom: "",
    dateTo: "",
    status: "",
    search: "",
    paymentStatus: "",
  });
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (applied.dateFrom) query.set("dateFrom", applied.dateFrom);
  if (applied.dateTo) query.set("dateTo", applied.dateTo);
  if (applied.status) query.set("status", applied.status);
  if (applied.search) query.set("search", applied.search);
  if (applied.paymentStatus) query.set("paymentStatus", applied.paymentStatus);
  const list = useAdminList(
    `/api/admin/orders?${query.toString()}`,
    parseAdminOrders,
  );
  const { request } = useAuth();
  const [detailError, setDetailError] = useState("");
  const [detailBusy, setDetailBusy] = useState(false);
  const detailVersion = useRef(0);
  const [selected, setSelected] = useState<AdminOrder | null>(null);
  const [progressBusyId, setProgressBusyId] = useState<number | null>(null);
  const [progressError, setProgressError] = useState("");
  const [progressMessage, setProgressMessage] = useState("");

  const open = useCallback(
    async (id: number, updateUrl = true) => {
      if (updateUrl)
        window.history.replaceState(null, "", `/admin/orders?id=${id}`);
      setCancelReason("");
      const version = ++detailVersion.current;
      setDetailBusy(true);
      setDetailError("");
      setSelected(null);
      try {
        const data = parseAdminOrder(await request(`/api/admin/orders/${id}`));
        if (version === detailVersion.current) setSelected(data);
      } catch (cause) {
        if (version === detailVersion.current)
          setDetailError(
            cause instanceof Error
              ? cause.message
              : "Không tải được chi tiết đơn.",
          );
      } finally {
        if (version === detailVersion.current) setDetailBusy(false);
      }
    },
    [request],
  );

  useEffect(() => {
    const load = () => {
      const id = Number(new URLSearchParams(window.location.search).get("id"));
      if (Number.isSafeInteger(id) && id > 0 && id <= 2147483647)
        void open(id, false);
    };
    load();
    window.addEventListener("popstate", load);
    const requestCounter = detailVersion;
    return () => {
      ++requestCounter.current;
      window.removeEventListener("popstate", load);
    };
  }, [open]);

  function closeDetail() {
    ++detailVersion.current;
    setSelected(null);
    setDetailBusy(false);
    setDetailError("");
    window.history.replaceState(null, "", "/admin/orders");
  }

  async function cancelOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !selected ||
      cancelBusy ||
      !cancelReason.trim() ||
      !window.confirm(`Hủy đơn #${selected.id}? Lý do: ${cancelReason.trim()}`)
    )
      return;
    const selectionVersion = detailVersion.current;
    setCancelBusy(true);
    setProgressError("");
    setProgressMessage("");
    try {
      await request(`/api/admin/orders/${selected.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      setProgressMessage(`Đã hủy đơn #${selected.id}.`);
      list.reload();
      if (selectionVersion === detailVersion.current) await open(selected.id);
    } catch (cause) {
      setProgressError(
        cause instanceof Error ? cause.message : "Không hủy được đơn.",
      );
      list.reload();
      if (selectionVersion === detailVersion.current) await open(selected.id);
    } finally {
      setCancelBusy(false);
    }
  }

  function applyFilters(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dateFrom && dateTo && dateFrom > dateTo) {
      setProgressError("Ngày bắt đầu không được sau ngày kết thúc.");
      return;
    }
    setProgressError("");
    setPage(1);
    setApplied({
      dateFrom,
      dateTo,
      status,
      search: search.trim(),
      paymentStatus,
    });
  }

  function clearFilters() {
    setDateFrom("");
    setDateTo("");
    setStatus("");
    setSearch("");
    setPaymentStatus("");
    setApplied({
      dateFrom: "",
      dateTo: "",
      status: "",
      search: "",
      paymentStatus: "",
    });
    setProgressError("");
    setPage(1);
  }

  async function advanceProgress(order: AdminOrder) {
    const next = nextProgress(order.status);
    if (
      !next ||
      progressBusyId !== null ||
      !window.confirm(`Đơn #${order.id}: chuyển sang “${next.label}”?`)
    )
      return;
    const selectionVersion = detailVersion.current;
    setProgressBusyId(order.id);
    setProgressError("");
    setProgressMessage("");
    try {
      await request(`/api/admin/orders/${order.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next.status }),
      });
      setProgressMessage(`Đơn #${order.id}: ${statusNames[next.status]}.`);
      list.reload();
      if (
        selected?.id === order.id &&
        selectionVersion === detailVersion.current
      )
        await open(order.id);
    } catch (cause) {
      setProgressError(
        cause instanceof Error
          ? cause.message
          : "Không cập nhật được tiến độ đơn.",
      );
      list.reload();
    } finally {
      setProgressBusyId(null);
    }
  }

  return {
    page,
    setPage,
    limit,
    setLimit,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    status,
    setStatus,
    search,
    setSearch,
    paymentStatus,
    setPaymentStatus,
    cancelReason,
    setCancelReason,
    cancelBusy,
    list,
    detailError,
    detailBusy,
    selected,
    progressBusyId,
    progressError,
    progressMessage,
    open,
    closeDetail,
    cancelOrder,
    applyFilters,
    clearFilters,
    advanceProgress,
  };
}
export type OrdersModel = ReturnType<typeof useAdminOrders>;
