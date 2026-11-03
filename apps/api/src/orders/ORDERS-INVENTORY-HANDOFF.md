# Orders ingredient inventory handoff

This is the inventory contract for the Payments owner (Thắng). Inventory is
provider-independent: it does not verify any gateway signature, parse a provider
payload, or edit the Payments adapter. The provider-specific part (ZaloPay
callback/query) decides what counts as "success" or "failure"; this module only
changes stock/reservation/Order status once that decision is made.

> Ghi chú lịch sử: bản đầu của tài liệu viết cho luồng IPN VNPAY. Contract kho
> không đổi khi đổi provider; chỉ thuật ngữ ở phần tích hợp được cập nhật.

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

Provider-neutral wording; for ZaloPay the "event" below is a verified callback
or a verified order-status query result. Thắng verifies the provider's success
definition and signature; none of that goes into the inventory helper.

1. Call `consumeReservation(tx, orderId)` on the first valid SUCCESS event
   before recording Payment SUCCESS. When the result is `EXPIRED`, leave the
   payment out of SUCCESS and persist an explicit reconciliation outcome/log.
2. Call `releaseReservation(tx, orderId, 'PAYMENT_FAILED'|'CANCELLED')` for a
   verified failed/cancelled event in the same transaction as the Payment update.
3. Remove the old `PAYMENT_FAILED -> PENDING` retry branch. A released order is
   not reusable; checkout must create a new order.
4. Ensure Payment, Order, inventory, and loyalty updates commit or roll back
   together. The frontend return URL must not consume inventory or mark PAID.
5. Callback, status query and the expiry batch may run at the same time. They
   are safe because every helper first takes `SELECT ... FOR UPDATE` on the
   `Order` row, then on its `OrderIngredient` rows (ascending ingredient id),
   and the expiry batch uses `FOR UPDATE SKIP LOCKED`. Proposal to confirm with
   Thắng: call the helper **before** writing the Payment row so every path locks
   in the same order (Order → OrderIngredient → Ingredient → Payment), and keep
   `Payment.transactionRef` unique as the idempotency key for duplicate events.

## Admin access (role from the database)

Admin rights come from `User.role` in the database, never from the JWT. The
login token only carries `sub`; any `role`, `isAdmin` or `roles` claim in a
token is ignored.

- `AdminClaimGuard` loads the user via `AuthService.me(userId)` on every request
  and sets `request.user.isAdmin = (role === 'ADMIN')`. It does not reject
  customers.
- `AdminGuard` runs `AdminClaimGuard` and returns `403` when the user is not an
  ADMIN (`401` when the token is missing/invalid).
- `GET /auth/me` returns `{ id, email, loyaltyPoints, role }`.
- `GET /orders/:id` uses `AdminClaimGuard`: a customer sees only their own order
  (another customer's order is `404`), an ADMIN can view any order's detail.
- `/admin/orders` and `/admin/orders/:id` use `AdminGuard`.
- Changing a user's role takes effect on the next request with the same token.
  Khoa does not need to put a trusted role into the token.

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
