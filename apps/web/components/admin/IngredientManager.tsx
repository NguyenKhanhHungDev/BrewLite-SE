"use client";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "../AuthProvider";
import { parseIngredients, type Ingredient } from "@/lib/ingredients";
import { useAdminList } from "./useAdminList";
type Edit = { mode: "create" | "edit" | "restock"; item?: Ingredient };
export default function IngredientManager() {
  const list = useAdminList("/ingredients", parseIngredients);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [success, setSuccess] = useState("");
  return (
    <>
      <div className="bl-admin-title">
        <h1>Nguyên liệu</h1>
        <button
          className="bl-button"
          onClick={() => {
            setSuccess("");
            setEdit({ mode: "create" });
          }}
        >
          Thêm nguyên liệu
        </button>
      </div>
      {list.loading && <p role="status">Đang tải nguyên liệu…</p>}
      {list.error && (
        <p role="alert">
          {list.error} <button onClick={list.reload}>Thử lại</button>
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {edit && (
        <IngredientForm
          key={`${edit.mode}:${edit.item?.id}`}
          edit={edit}
          close={() => setEdit(null)}
          saved={() => {
            setEdit(null);
            setSuccess("Đã cập nhật nguyên liệu.");
            list.reload();
          }}
        />
      )}
      {list.data?.length === 0 && <p>Chưa có nguyên liệu</p>}
      {!!list.data?.length && (
        <div className="bl-admin-table">
          <table>
            <thead>
              <tr>
                {[
                  "Tên",
                  "Đơn vị",
                  "Tồn thực",
                  "Đang giữ",
                  "Khả dụng",
                  "Ngưỡng tồn",
                  "Tình trạng",
                  "Thao tác",
                ].map((label) => (
                  <th key={label}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.data.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td>{item.unit}</td>
                  <td>{item.stock}</td>
                  <td>{item.reserved}</td>
                  <td>{item.available}</td>
                  <td>{item.minStock}</td>
                  <td>
                    {item.available <= item.minStock ? "Sắp hết" : "Còn hàng"}
                  </td>
                  <td>
                    <button
                      onClick={() => {
                        setSuccess("");
                        setEdit({ mode: "edit", item });
                      }}
                    >
                      Sửa
                    </button>{" "}
                    <button
                      onClick={() => {
                        setSuccess("");
                        setEdit({ mode: "restock", item });
                      }}
                    >
                      Nhập kho
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
function IngredientForm({
  edit,
  close,
  saved,
}: {
  edit: Edit;
  close: () => void;
  saved: () => void;
}) {
  const { request } = useAuth();
  const [name, setName] = useState(edit.item?.name ?? "");
  const [unit, setUnit] = useState("g");
  const [stock, setStock] = useState("0");
  const [minStock, setMinStock] = useState(String(edit.item?.minStock ?? 0));
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      const number = (value: string, min: number) => {
        const result = Number(value);
        if (
          !value.trim() ||
          !Number.isInteger(result) ||
          result < min ||
          result > 2147483647
        )
          throw new Error("Số lượng không hợp lệ.");
        return result;
      };
      if (edit.mode !== "restock" && !name.trim())
        throw new Error("Nhập tên nguyên liệu.");
      const body =
        edit.mode === "restock"
          ? { quantity: number(quantity, 1) }
          : edit.mode === "edit"
            ? { name: name.trim(), minStock: number(minStock, 0) }
            : {
                name: name.trim(),
                unit,
                stock: number(stock, 0),
                minStock: number(minStock, 0),
              };
      await request(
        edit.mode === "create"
          ? "/ingredients"
          : `/ingredients/${edit.item!.id}${edit.mode === "restock" ? "/restock" : ""}`,
        {
          method: edit.mode === "edit" ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      saved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không lưu được nguyên liệu.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="bl-panel bl-admin-form" onSubmit={submit}>
      <h2>
        {edit.mode === "create"
          ? "Thêm nguyên liệu"
          : edit.mode === "edit"
            ? "Sửa nguyên liệu"
            : `Nhập kho: ${edit.item?.name}`}
      </h2>
      <fieldset disabled={busy}>
        {edit.mode === "restock" ? (
          <label>
            Số lượng nhập ({edit.item?.unit})
            <input
              type="number"
              min="1"
              max="2147483647"
              step="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label>
              Tên
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {edit.mode === "create" && (
              <>
                <label>
                  Đơn vị
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="g">g</option>
                    <option value="ml">ml</option>
                  </select>
                </label>
                <label>
                  Tồn ban đầu
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              Ngưỡng tồn
              <input
                type="number"
                min="0"
                step="1"
                required
                value={minStock}
                onChange={(e) => setMinStock(e.target.value)}
              />
            </label>
          </>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="bl-actions">
          <button className="bl-button" type="submit">
            {busy ? "Đang lưu…" : "Lưu"}
          </button>
          <button type="button" onClick={close}>
            Đóng
          </button>
        </div>
      </fieldset>
    </form>
  );
}
