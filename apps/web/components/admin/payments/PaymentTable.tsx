"use client";
import { paymentName } from "@/lib/admin-orders";
import { money } from "@/lib/pricing";
import Link from "next/link";
import { vietnamTime } from "./payments-config";
import type { PaymentsModel } from "./useAdminPayments";
export default function PaymentTable({ model }: { model: PaymentsModel }) {
  const { list, busy, loadingDetail, setMessage, open } = model;
  return (
    <>
      {!!list.data?.data.length && (
        <div className="bl-admin-table">
          <table>
            <thead>
              <tr>
                <th>Giao dịch</th>
                <th>Đơn / khách hàng</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Tạo lúc (VN)</th>
                <th>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((p) => (
                <tr key={p.id}>
                  <td>
                    #{p.id}
                    <br />
                    {p.transactionRef ?? "Chưa có tham chiếu"}
                  </td>
                  <td>
                    <Link href={`/admin/orders?id=${p.orderId}`}>
                      Đơn #{p.orderId}
                    </Link>
                    <br />
                    {p.order.recipientName ?? p.order.user.name}
                    <br />
                    {p.order.user.email}
                  </td>
                  <td>{money(p.amount)}</td>
                  <td>{paymentName(p.status)}</td>
                  <td>{vietnamTime(p.createdAt)}</td>
                  <td>
                    <button
                      disabled={busy || loadingDetail}
                      onClick={() => {
                        setMessage("");
                        void open(p.id);
                      }}
                    >
                      Chi tiết
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
