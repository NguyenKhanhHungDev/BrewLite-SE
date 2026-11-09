"use client";
import { paymentName } from "@/lib/admin-orders";
import { statusNames } from "@/lib/orders";
import { money } from "@/lib/pricing";
import { nextProgress } from "./orders-config";
import type { OrdersModel } from "./useAdminOrders";
export default function OrderTable({ model }: { model: OrdersModel }) {
  const { list, progressBusyId, open, advanceProgress } = model;
  return (
    <>
      {!!list.data?.data.length && (
        <div className="bl-admin-table">
          <table>
            <thead>
              <tr>
                <th>Mã đơn / Khách hàng</th>
                <th>Tổng tiền</th>
                <th>Trạng thái đơn</th>
                <th>Thanh toán</th>
                <th>Tiến độ pha chế</th>
                <th>Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {list.data.data.map((order) => {
                const next = nextProgress(order.status);
                return (
                  <tr key={order.id}>
                    <td>
                      #{order.id}
                      <br />
                      {order.recipientName ?? order.userEmail}
                    </td>
                    <td>{money(order.total)}</td>
                    <td>{statusNames[order.status]}</td>
                    <td>{paymentName(order.paymentStatus)}</td>
                    <td>
                      {next ? (
                        <button
                          disabled={progressBusyId !== null}
                          onClick={() => void advanceProgress(order)}
                        >
                          {progressBusyId === order.id
                            ? "Đang cập nhật…"
                            : next.label}
                        </button>
                      ) : order.status === "PENDING" ? (
                        "Chờ thanh toán"
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <button onClick={() => void open(order.id)}>Xem</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
