# Orders ingredient inventory handoff

This is the inventory contract for the Payments/IPN owner. It intentionally does
not implement VNPAY signature verification or edit the Payments adapter.

## Transaction helpers

Import from `src/orders/orders.inventory.ts`:

```ts
import {
  consumeReservation,
  releaseReservation,
} from '../orders/orders.inventory.js';
```

Both helpers receive the caller's Prisma interactive transaction client. They do
not open or commit a transaction themselves.

```ts
await prisma.$transaction(async (tx) => {
  const result = await consumeReservation(tx, orderId);
  if (result === 'EXPIRED') {
    // The helper has changed the order to CANCELLED and released its reservation.
    // Do not mark the Payment SUCCESS or award loyalty. Record reconciliation.
    return;
  }
  // CONSUMED is the first successful consumption. ALREADY_CONSUMED and
  // LEGACY_ORDER are idempotent/legacy outcomes. Update Payment and award
  // loyalty in this same transaction.
});
```

For failure/cancel:

```ts
await prisma.$transaction(async (tx) => {
  await releaseReservation(tx, orderId, 'PAYMENT_FAILED');
  // Or 'CANCELLED'. Then update Payment in this same transaction.
});
```

`consumeReservation` performs `PENDING -> PAID` itself. `releaseReservation`
performs `PENDING -> PAYMENT_FAILED|CANCELLED` itself. Do not perform a second
Order status update after invoking either helper. Duplicate calls are safe:
only `OrderIngredient.status = RESERVED` rows change stock/reserved.

## Required Payments-side changes before end-to-end payment tests

1. Call `consumeReservation(tx, orderId)` in the first valid SUCCESS IPN before
   recording Payment SUCCESS. When result is `EXPIRED`, leave the payment out of
   SUCCESS and persist an explicit reconciliation outcome/log.
2. Call `releaseReservation(tx, orderId, 'PAYMENT_FAILED'|'CANCELLED')` for a
   failed/cancelled IPN in the same transaction as the Payment update.
3. Remove the old `PAYMENT_FAILED -> PENDING` retry branch. A released order is
   not reusable; checkout must create a new order.
4. Ensure Payment, Order, inventory, and loyalty updates commit or roll back
   together. The frontend return URL must not consume inventory or mark PAID.

## Admin JWT dependency

`AdminGuard` accepts a signed JWT with `role: "ADMIN"`, `isAdmin: true`, or
`roles: ["ADMIN"]`. The current ZIP's login token only contains `sub`, and the
current User schema has no role field. Khoa must add the approved role source and
claim before admin endpoints can be used; this branch intentionally does not
change User schema, migrations, or login behavior.

## API for Huy

`GET /admin/orders?page=1&limit=20` returns:

```json
{
  "data": [
    {
      "id": 123,
      "status": "PENDING",
      "total": 50000,
      "createdAt": "2026-11-02T12:00:00.000Z",
      "expiresAt": "2026-11-02T12:15:00.000Z",
      "userEmail": "customer@example.com",
      "paymentStatus": "PENDING",
      "items": [
        {
          "recipeId": 4,
          "recipeName": "Cà phê sữa",
          "productId": 4,
          "quantity": 2,
          "size": "M",
          "toppings": [],
          "unitPrice": 25000,
          "subtotal": 50000
        }
      ]
    }
  ],
  "page": 1,
  "limit": 20,
  "total": 1,
  "totalPages": 1
}
```

`limit` is capped at 50. `GET /admin/orders/:id` returns one order with the same
fields. Customer order lookup remains `GET /orders/:id` and is scoped to the
authenticated owner.
