"use client";
import { type OrderStatus } from "@/lib/orders";
import { statusOptions } from "./orders-config";
import type { OrdersModel } from "./useAdminOrders";
export default function OrderFilters({ model }: { model: OrdersModel }) {
  const {
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
    applyFilters,
    clearFilters,
  } = model;
  return (
    <>
      <form className="bl-admin-form bl-order-filters" onSubmit={applyFilters}>
        <fieldset>
          <legend>Lọc đơn hàng</legend>
          <div className="bl-order-filter-grid">
            <label>
              Tìm đơn hoặc khách hàng
              <input
                value={search}
                maxLength={200}
                placeholder="Mã đơn, tên, email"
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <label>
              Thanh toán
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value)}
              >
                {[
                  ["", "Tất cả thanh toán"],
                  ["NONE", "Chưa có giao dịch"],
                  ["PENDING", "Chờ xác nhận"],
                  ["SUCCESS", "Đã thanh toán"],
                  ["FAILED", "Thất bại"],
                  ["CANCELLED", "Đã hủy"],
                  ["RECONCILIATION_REQUIRED", "Cần đối soát"],
                ].map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ ngày (giờ Việt Nam)
              <input
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
              />
            </label>
            <label>
              Đến ngày (giờ Việt Nam)
              <input
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
              />
            </label>
            <label>
              Trạng thái đơn
              <select
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as OrderStatus | "")
                }
              >
                {statusOptions.map((option) => (
                  <option key={option.value || "all"} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="bl-actions">
            <button className="bl-button" type="submit">
              Áp dụng bộ lọc
            </button>
            <button
              className="bl-button bl-button-secondary"
              type="button"
              onClick={clearFilters}
            >
              Xóa bộ lọc
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
