import { ApiError } from "./api";

// These errors confirm that no order was saved, so a refreshed draft is safe.
// Unknown 409 responses retain the original key and snapshot.
export function isKnownOrderConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 409 &&
    (error.code === "ORDER_CATALOG_CHANGED" ||
      error.message === "Tồn kho vừa thay đổi, hãy thử lại")
  );
}
