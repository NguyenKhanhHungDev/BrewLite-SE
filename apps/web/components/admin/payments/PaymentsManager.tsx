"use client";
import { paymentName } from "@/lib/admin-orders";
import { downloadCsv } from "@/lib/admin-tools";
import PaymentDetailsPanel from "./PaymentDetailsPanel";
import PaymentFilters from "./PaymentFilters";
import PaymentTable from "./PaymentTable";
import { vietnamTime } from "./payments-config";
import { useAdminPayments } from "./useAdminPayments";
export default function PaymentsManager() {
  const model = useAdminPayments();
  const {
    page,
    setPage,
    limit,
    setLimit,
    list,
    loadingDetail,
    error,
    message,
  } = model;
  return (
    <section>
      <h1>Giao dịch &amp; đối soát</h1>
      <p>
        Tra cứu các lần thanh toán. Ghi chú chỉ phục vụ quản trị. Giao dịch cần
        đối soát phải được xử lý thủ công khi không thể tự xác minh an toàn.
      </p>
      <PaymentFilters model={model} />
      <div className="bl-admin-toolbar">
        <label>
          Số giao dịch mỗi trang
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
          >
            {[10, 20, 50].map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <button
          disabled={!list.data?.data.length || list.loading}
          onClick={() =>
            downloadCsv(
              "giao-dich-trang-hien-tai.csv",
              [
                "Mã giao dịch",
                "Mã đơn",
                "Tham chiếu",
                "Khách hàng",
                "Trạng thái",
                "Số tiền VND",
                "Tạo lúc VN",
                "Ghi chú quản trị",
              ],
              (list.data?.data ?? []).map((p) => [
                p.id,
                p.orderId,
                p.transactionRef,
                p.order.user.email,
                paymentName(p.status),
                p.amount,
                vietnamTime(p.createdAt),
                p.adminNote,
              ]),
            )
          }
        >
          Xuất CSV trang kết quả đang xem
        </button>
      </div>
      {error && (
        <p role="alert" className="bl-alert bl-alert-error">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="bl-alert">
          {message}
        </p>
      )}
      {list.loading && <p role="status">Đang tải giao dịch…</p>}
      {list.error && (
        <p role="alert">
          {list.error} <button onClick={list.reload}>Thử lại</button>
        </p>
      )}
      {list.data && (
        <p className="bl-admin-stats">
          {list.data.total} giao dịch phù hợp · Trang {list.data.page}/
          {Math.max(1, list.data.totalPages)}
        </p>
      )}
      {list.data?.data.length === 0 && (
        <p>Không có giao dịch phù hợp bộ lọc.</p>
      )}
      <PaymentTable model={model} />
      <div className="bl-admin-pagination">
        <button
          disabled={page <= 1 || list.loading}
          onClick={() => setPage(page - 1)}
        >
          Trang trước
        </button>
        <span>Trang {page}</span>
        <button
          disabled={!list.data || page >= list.data.totalPages || list.loading}
          onClick={() => setPage(page + 1)}
        >
          Trang sau
        </button>
      </div>
      {loadingDetail && <p role="status">Đang tải chi tiết…</p>}
      <PaymentDetailsPanel model={model} />
    </section>
  );
}
