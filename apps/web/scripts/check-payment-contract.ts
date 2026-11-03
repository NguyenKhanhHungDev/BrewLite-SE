import assert from "node:assert/strict";
import {
  parseOrderId,
  parsePaymentLink,
  parsePaymentOrder,
  parsePaymentStatus,
  paymentView,
} from "../lib/payments";

const status = {
  orderId: 123,
  orderStatus: "PENDING",
  latestPayment: {
    paymentId: 456,
    provider: "ZALOPAY",
    transactionRef: "sandbox-reference",
    amount: 70000,
    status: "PENDING",
    paidAt: null,
  },
};
for (const input of [
  null,
  "",
  "0",
  "-1",
  "1.5",
  "1e2",
  "01",
  "123?status=SUCCESS",
  "2147483648",
])
  assert.equal(parseOrderId(input), null);
assert.equal(parseOrderId("123"), 123);
assert.equal(paymentView(parsePaymentStatus(status, 123)), "pending");
assert.equal(
  paymentView(parsePaymentStatus({ ...status, latestPayment: null }, 123)),
  "pending",
);
assert.throws(() => parsePaymentStatus({ ...status, orderId: 124 }, 123));
assert.throws(() =>
  parsePaymentStatus({ ...status, orderStatus: "UNKNOWN" }, 123),
);
for (const invalid of [
  { amount: -1 },
  { paymentId: "456" },
  { status: "UNKNOWN" },
  { paidAt: "invalid-date" },
]) {
  assert.throws(() =>
    parsePaymentStatus(
      { ...status, latestPayment: { ...status.latestPayment, ...invalid } },
      123,
    ),
  );
}
assert.equal(
  paymentView(
    parsePaymentStatus(
      {
        ...status,
        orderStatus: "PAID",
        latestPayment: { ...status.latestPayment, status: "SUCCESS" },
      },
      123,
    ),
  ),
  "success",
);
assert.equal(
  paymentView(parsePaymentStatus({ ...status, orderStatus: "CANCELLED" }, 123)),
  "cancelled",
);
assert.equal(
  paymentView(
    parsePaymentStatus({ ...status, orderStatus: "PAYMENT_FAILED" }, 123),
  ),
  "failed",
);
for (const orderStatus of ["PENDING", "CANCELLED"])
  assert.equal(
    paymentView(
      parsePaymentStatus(
        {
          ...status,
          orderStatus,
          latestPayment: { ...status.latestPayment, status: "SUCCESS" },
        },
        123,
      ),
    ),
    "reconciliation",
  );
assert.equal(
  paymentView(
    parsePaymentStatus(
      { ...status, orderStatus: "PAID", latestPayment: null },
      123,
    ),
  ),
  "reconciliation",
);
assert.equal(
  paymentView(
    parsePaymentStatus(
      {
        ...status,
        latestPayment: {
          ...status.latestPayment,
          status: "RECONCILIATION_REQUIRED",
        },
      },
      123,
    ),
  ),
  "reconciliation",
);
const link = {
  orderId: 123,
  paymentId: 456,
  paymentUrl: "https://sbgateway.zalopay.vn/order?token=test",
};
assert.equal(parsePaymentLink(link, 123).paymentUrl, link.paymentUrl);
for (const paymentUrl of [
  "javascript:alert(1)",
  "/checkout",
  "http://sbgateway.zalopay.vn/order",
  "https://zalopay.vn.evil.invalid",
  "https://example.invalid",
  "https://user:password@sbgateway.zalopay.vn",
  "https://sbgateway.zalopay.vn:8443/order",
])
  assert.throws(() => parsePaymentLink({ ...link, paymentUrl }, 123));
assert.throws(() => parsePaymentLink(link, 124));
const order = {
  id: 123,
  total: 70000,
  items: [
    {
      recipeName: "Tên tại lúc đặt",
      quantity: 2,
      size: "M",
      toppings: [],
      unitPrice: 35000,
      subtotal: 70000,
    },
  ],
};
assert.equal(parsePaymentOrder(order, 123).items[0].name, "Tên tại lúc đặt");
assert.throws(() => parsePaymentOrder(order, 124));
assert.throws(() =>
  parsePaymentOrder(
    { ...order, items: [{ ...order.items[0], quantity: 0 }] },
    123,
  ),
);
console.log(
  "PASS: order IDs, payment response validation, coherent success/reconciliation, safe gateway URLs and order snapshots",
);
