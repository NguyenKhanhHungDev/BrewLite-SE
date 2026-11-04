import assert from "node:assert/strict";
import { addCartLine, reconcileCart } from "../lib/cart";
import { parseProducts } from "../lib/products";
const product = parseProducts([
  {
    id: 1,
    name: "Test",
    price: 30000,
    imageUrl: "/test.jpg",
    stock: 0,
    stockBySize: { S: 1, M: 0, L: 0 },
  },
])[0];
const lines = addCartLine([], product, "S", [], 1);
assert.equal(lines.length, 1);
assert.deepEqual(reconcileCart(lines, [product]).issues, []);
assert.throws(() => addCartLine([], product, "M", [], 1));
assert.throws(() => addCartLine([], product, "S", [], 2));
assert.throws(() =>
  parseProducts([{ ...product, stockBySize: { S: -1, M: 0, L: 0 } }]),
);
console.log(
  "PASS: size S availability, cart reconciliation and invalid size stock",
);

import { ApiError } from "../lib/api";
import { isKnownOrderConflict } from "../lib/order-conflict";
assert.equal(
  isKnownOrderConflict(
    new ApiError("Giá đã đổi", 409, "ORDER_CATALOG_CHANGED"),
  ),
  true,
);
assert.equal(
  isKnownOrderConflict(new ApiError("Unknown conflict", 409)),
  false,
);
assert.equal(isKnownOrderConflict(new ApiError("Timeout", 503)), false);
console.log(
  "PASS: reset only confirmed catalog conflicts; preserve uncertain attempts",
);

import { sizePrice } from "../lib/pricing";
assert.equal(sizePrice(4000, "M"), 4000);
assert.equal(sizePrice(4000, "S"), null);
console.log(
  "PASS: unavailable size price does not throw while rendering options",
);
