"use client";
import IngredientFilters from "./IngredientFilters";
import IngredientForm from "./IngredientForm";
import IngredientTable from "./IngredientTable";
import InventoryHistoryPanel from "./InventoryHistoryPanel";
import { useAdminIngredients } from "./useAdminIngredients";
export default function IngredientManager() {
  const model = useAdminIngredients();
  const { list, edit, setEdit, success, all, rows, open, saved } = model;
  return (
    <>
      <div className="bl-admin-title">
        <div>
          <h1>Nguyên liệu</h1>
          <p>Theo dõi tồn thực, lượng giữ cho đơn hàng và lịch sử kiểm kho.</p>
        </div>
        <button className="bl-button" onClick={() => open("create")}>
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
      <div className="bl-admin-stats" aria-label="Tổng quan nguyên liệu">
        <div>
          <strong>{all.length}</strong>
          <span>Nguyên liệu</span>
        </div>
        <div>
          <strong>{all.filter((r) => r.available <= r.minStock).length}</strong>
          <span>Chạm ngưỡng tồn</span>
        </div>
        <div>
          <strong>{all.filter((r) => r.available <= 0).length}</strong>
          <span>Hết khả dụng</span>
        </div>
        <div>
          <strong>{all.filter((r) => r.reserved > 0).length}</strong>
          <span>Có hàng đang giữ</span>
        </div>
      </div>
      <IngredientFilters model={model} />
      {edit &&
        (edit.mode === "history" ? (
          <InventoryHistoryPanel
            key={edit.item!.id}
            item={edit.item!}
            close={() => setEdit(null)}
          />
        ) : (
          <IngredientForm
            key={`${edit.mode}:${edit.item?.id}`}
            edit={edit}
            close={() => setEdit(null)}
            saved={saved}
            refresh={() => {
              setEdit(null);
              list.reload();
            }}
          />
        ))}
      {!list.loading && !all.length && !list.error && (
        <p>Chưa có nguyên liệu. Thêm nguyên liệu đầu tiên để bắt đầu.</p>
      )}
      {!!all.length && !rows.length && <p>Không có nguyên liệu khớp bộ lọc.</p>}
      <IngredientTable model={model} />
    </>
  );
}
