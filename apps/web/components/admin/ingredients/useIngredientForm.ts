"use client";
import { useAuth } from "@/components/AuthProvider";
import { ApiError } from "@/lib/api";
import {
  inventoryInteger,
  stableInventoryRequest,
  type InventoryRequestIdentity,
} from "@/lib/inventory-admin";
import { useRef, useState, type FormEvent } from "react";
import { type IngredientEdit } from "./ingredients-config";
export type IngredientFormProps = {
  edit: IngredientEdit;
  close: () => void;
  saved: () => void;
  refresh: () => void;
};
/** Draft fields, validation and API submission for this form. */
export function useIngredientForm({ edit, saved }: IngredientFormProps) {
  const { request } = useAuth();
  const [name, setName] = useState(edit.item?.name ?? "");
  const [unit, setUnit] = useState("g");
  const [stock, setStock] = useState(
    String(edit.mode === "adjust" ? edit.item!.stock : 0),
  );
  const [minStock, setMinStock] = useState(String(edit.item?.minStock ?? 0));
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const identity = useRef<InventoryRequestIdentity | undefined>(undefined);
  const stockOperation = edit.mode === "restock" || edit.mode === "adjust";
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setConflict(false);
    try {
      if (edit.mode === "delete") {
        if (!confirmed)
          throw new Error("Xác nhận xóa nguyên liệu trước khi tiếp tục.");
        await request(`/ingredients/${edit.item!.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });
      } else {
        if (stockOperation && !reason.trim())
          throw new Error("Nhập lý do thao tác kho.");
        if (!stockOperation && !name.trim())
          throw new Error("Nhập tên nguyên liệu.");
        if (edit.mode === "adjust" && edit.item!.version === undefined)
          throw new Error("Tải lại dữ liệu để có phiên bản tồn kho mới nhất.");
        const body =
          edit.mode === "restock"
            ? { quantity: inventoryInteger(quantity, 1), reason: reason.trim() }
            : edit.mode === "adjust"
              ? {
                  stock: inventoryInteger(stock, 0),
                  expectedVersion: edit.item!.version,
                  reason: reason.trim(),
                }
              : edit.mode === "edit"
                ? { name: name.trim(), minStock: inventoryInteger(minStock, 0) }
                : {
                    name: name.trim(),
                    unit,
                    stock: inventoryInteger(stock, 0),
                    minStock: inventoryInteger(minStock, 0),
                  };
        if (edit.mode === "adjust" && Number(body.stock) < edit.item!.reserved)
          throw new Error("Tồn thực không được thấp hơn số lượng đang giữ.");
        const path =
          edit.mode === "create"
            ? "/ingredients"
            : `/ingredients/${edit.item!.id}${stockOperation ? `/${edit.mode}` : ""}`;
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (stockOperation) {
          identity.current = stableInventoryRequest(
            identity.current,
            JSON.stringify({ path, body }),
            () => crypto.randomUUID(),
          );
          headers["Idempotency-Key"] = identity.current.key;
        }
        await request(path, {
          method: edit.mode === "edit" ? "PATCH" : "POST",
          headers,
          body: JSON.stringify(body),
        });
      }
      saved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không lưu được nguyên liệu.",
      );
      setConflict(cause instanceof ApiError && cause.status === 409);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const title =
    edit.mode === "create"
      ? "Thêm nguyên liệu"
      : edit.mode === "edit"
        ? `Sửa: ${edit.item!.name}`
        : edit.mode === "restock"
          ? `Nhập kho: ${edit.item!.name}`
          : edit.mode === "adjust"
            ? `Kiểm kho: ${edit.item!.name}`
            : `Xóa: ${edit.item!.name}`;

  return {
    name,
    setName,
    unit,
    setUnit,
    stock,
    setStock,
    minStock,
    setMinStock,
    quantity,
    setQuantity,
    reason,
    setReason,
    confirmed,
    setConfirmed,
    error,
    conflict,
    busy,
    stockOperation,
    submit,
    title,
  };
}
