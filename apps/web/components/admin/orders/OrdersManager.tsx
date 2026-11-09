"use client";
import { paymentName } from "@/lib/admin-orders";
import { downloadCsv } from "@/lib/admin-tools";
import { statusNames } from "@/lib/orders";
import OrderDetails from "./OrderDetails";
import OrderFilters from "./OrderFilters";
import OrderTable from "./OrderTable";
import { useAdminOrders } from "./useAdminOrders";
export default function OrdersManager() {
  const model = useAdminOrders();
  const {
    page,
    setPage,
    limit,
    setLimit,
    list,
    detailError,
    detailBusy,
    selected,
    progressError,
    progressMessage,
  } = model;
  return (
    <>
      <h1>Đơn hàng</h1>
      <OrderFilters model={model} />
      <label>
        Số đơn mỗi trang{" "}
        <select
          value={limit}
          onChange={(event) => {
            setPage(1);
            setLimit(Number(event.target.value));
          }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </label>
      <button
        disabled={!list.data?.data.length || list.loading}
        onClick={() =>
          downloadCsv(
            "don-hang-trang-hien-tai.csv",
            [
              "Mã đơn",
              "Ngày VN",
              "Khách hàng",
              "Người nhận",
              "Điện thoại",
              "Trạng thái đơn",
              "Thanh toán",
              "Tổng VND",
            ],
            (list.data?.data ?? []).map((o) => [
              o.id,
              new Date(o.createdAt).toLocaleString("vi-VN", {
                timeZone: "Asia/Ho_Chi_Minh",
              }),
              o.userEmail,
              o.recipientName,
              o.recipientPhone,
              statusNames[o.status],
              paymentName(o.paymentStatus),
              o.total,
            ]),
          )
        }
      >
        Xuất CSV trang kết quả đang xem
      </button>
      {progressError && !selected && !detailBusy && !detailError && (
        <p className="bl-alert bl-alert-error" role="alert">
          {progressError}
        </p>
      )}
      {progressMessage && !selected && !detailBusy && !detailError && (
        <p className="bl-alert" role="status">
          {progressMessage}
        </p>
      )}
      {list.loading && <p role="status">Đang tải đơn hàng…</p>}
      {list.error && (
        <p role="alert">
          {list.error} <button onClick={list.reload}>Thử lại</button>
        </p>
      )}
      {list.data?.data.length === 0 && <p>Không có đơn hàng phù hợp bộ lọc.</p>}
      {list.data && (
        <p>
          Tổng {list.data.total} đơn · Trang {list.data.page}/
          {Math.max(1, list.data.totalPages)}
        </p>
      )}
      <OrderTable model={model} />
      <div className="bl-actions">
        <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
          Trang trước
        </button>
        <button
          disabled={!list.data || page >= list.data.totalPages}
          onClick={() => setPage(page + 1)}
        >
          Trang sau
        </button>
        <button onClick={list.reload}>Tải lại</button>
      </div>
      <OrderDetails model={model} />
    </>
  );
}
