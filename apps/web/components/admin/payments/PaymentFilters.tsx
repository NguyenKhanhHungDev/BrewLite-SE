"use client";
import { paymentOptions } from "@/lib/admin-payments";
import { defaults } from "./payments-config";
import type { PaymentsModel } from "./useAdminPayments";
export default function PaymentFilters({ model }: { model: PaymentsModel }) {
  const { filters, setFilters, setApplied, setPage, list, setError, apply } =
    model;
  return (
    <>
      <form className="bl-panel bl-admin-form" onSubmit={apply}>
        <fieldset>
          <legend>Lọc giao dịch</legend>
          <div className="bl-admin-toolbar">
            <label>
              Tìm giao dịch / đơn / khách
              <input
                maxLength={200}
                value={filters.search}
                placeholder="Mã giao dịch, đơn, tên, email, điện thoại"
                onChange={(e) =>
                  setFilters({ ...filters, search: e.target.value })
                }
              />
            </label>
            <label>
              Trạng thái
              <select
                value={filters.status}
                onChange={(e) =>
                  setFilters({ ...filters, status: e.target.value })
                }
              >
                {paymentOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ ngày (Việt Nam)
              <input
                type="date"
                value={filters.dateFrom}
                max={filters.dateTo || undefined}
                onChange={(e) =>
                  setFilters({ ...filters, dateFrom: e.target.value })
                }
              />
            </label>
            <label>
              Đến ngày (Việt Nam)
              <input
                type="date"
                value={filters.dateTo}
                min={filters.dateFrom || undefined}
                onChange={(e) =>
                  setFilters({ ...filters, dateTo: e.target.value })
                }
              />
            </label>
          </div>
          <div className="bl-actions">
            <button className="bl-button">Áp dụng bộ lọc</button>
            <button
              type="button"
              onClick={() => {
                setFilters({ ...defaults, status: "ALL" });
                setApplied({ ...defaults, status: "ALL" });
                setPage(1);
                setError("");
              }}
            >
              Xóa bộ lọc
            </button>
            <button type="button" onClick={list.reload}>
              Tải lại danh sách
            </button>
          </div>
        </fieldset>
      </form>
    </>
  );
}
