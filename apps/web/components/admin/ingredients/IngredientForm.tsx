"use client";
import { topping } from "./ingredients-config";
import {
  useIngredientForm,
  type IngredientFormProps,
} from "./useIngredientForm";
export default function IngredientForm(props: IngredientFormProps) {
  const { edit, close, refresh } = props;
  const {
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
  } = useIngredientForm(props);
  return (
    <form
      className="bl-panel bl-admin-form"
      onSubmit={submit}
      aria-label={title}
    >
      <h2>{title}</h2>
      <fieldset disabled={busy}>
        {edit.mode === "delete" ? (
          <>
            <p>
              Chỉ xóa nguyên liệu chưa thuộc công thức, đơn hàng hoặc lịch sử
              kho. Thao tác này không thể hoàn tác.
            </p>
            <label>
              <input
                type="checkbox"
                checked={confirmed}
                required
                onChange={(e) => setConfirmed(e.target.checked)}
              />{" "}
              Tôi xác nhận xóa {edit.item!.name} (#{edit.item!.id}).
            </label>
          </>
        ) : stockOperation ? (
          <>
            <p>
              Tồn thực:{" "}
              <strong>
                {edit.item!.stock} {edit.item!.unit}
              </strong>{" "}
              · Đang giữ: {edit.item!.reserved} · Khả dụng:{" "}
              {edit.item!.available}
            </p>
            {edit.mode === "restock" ? (
              <label>
                Số lượng nhập ({edit.item!.unit})
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
                <p>
                  Nhập tổng tồn thực đã đếm. Đơn hàng có thể thay đổi tồn trong
                  khi kiểm kho; máy chủ sẽ yêu cầu tải lại nếu dữ liệu cũ.
                </p>
                <label>
                  Tồn thực sau kiểm kho ({edit.item!.unit})
                  <input
                    type="number"
                    min={edit.item!.reserved}
                    max="2147483647"
                    step="1"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </label>
              </>
            )}
            <label>
              Lý do {edit.mode === "restock" ? "nhập kho" : "điều chỉnh"}
              <textarea
                required
                maxLength={300}
                rows={2}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ví dụ: nhập hàng theo phiếu NK-001 / kiểm kê cuối ca"
              />
            </label>
            <p>
              Nếu chưa nhận được kết quả do mất kết nối, giữ nguyên nội dung và
              bấm Lưu lại để tránh ghi kho hai lần.
            </p>
          </>
        ) : (
          <>
            <label>
              Tên
              <input
                required
                value={name}
                disabled={!!edit.item && topping(edit.item)}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            {edit.mode === "create" ? (
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
                    max="2147483647"
                    step="1"
                    required
                    value={stock}
                    onChange={(e) => setStock(e.target.value)}
                  />
                </label>
              </>
            ) : (
              <p>
                Đơn vị: {edit.item!.unit}. Dùng Nhập kho hoặc Kiểm kho để thay
                đổi tồn.
              </p>
            )}
            <label>
              Ngưỡng cảnh báo tồn
              <input
                type="number"
                min="0"
                max="2147483647"
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
          <button
            className={
              edit.mode === "delete" ? "bl-button bl-admin-danger" : "bl-button"
            }
            type="submit"
            disabled={edit.mode === "delete" && !confirmed}
          >
            {busy
              ? "Đang lưu…"
              : edit.mode === "delete"
                ? "Xác nhận xóa"
                : "Lưu"}
          </button>
          {conflict && (
            <button type="button" onClick={refresh}>
              Đóng và tải lại dữ liệu
            </button>
          )}
          <button type="button" onClick={close}>
            Đóng
          </button>
        </div>
      </fieldset>
    </form>
  );
}
