"use client";
import RecipeFilters from "./RecipeFilters";
import RecipeForm from "./RecipeForm";
import RecipeGrid from "./RecipeGrid";
import { useAdminRecipes } from "./useAdminRecipes";
export default function RecipeManager() {
  const model = useAdminRecipes();
  const {
    list,
    ingredients,
    edit,
    setEdit,
    success,
    setSuccess,
    setPage,
    clone,
    setClone,
    actionError,
    filtered,
    totalPages,
    currentPage,
  } = model;
  return (
    <>
      <div className="bl-admin-title">
        <h1>Công thức</h1>
        <button
          className="bl-button"
          disabled={!ingredients.data?.length}
          onClick={() => {
            setSuccess("");
            setClone(false);
            setEdit(null);
          }}
        >
          Thêm món
        </button>
      </div>
      <RecipeFilters model={model} />
      <p>
        {list.data?.length ?? 0} món ·{" "}
        {list.data?.filter((i) => i.isActive).length ?? 0} đang bán ·{" "}
        {filtered.length} kết quả
      </p>
      {actionError && <p role="alert">{actionError}</p>}
      {list.loading && <p role="status">Đang tải công thức…</p>}
      {list.error && (
        <p role="alert">
          {list.error} <button onClick={list.reload}>Thử lại</button>
        </p>
      )}
      {ingredients.error && (
        <p role="alert">
          {ingredients.error}{" "}
          <button onClick={ingredients.reload}>Thử lại nguyên liệu</button>
        </p>
      )}
      {success && <p role="status">{success}</p>}
      {edit !== undefined && ingredients.data && (
        <RecipeForm
          key={`${clone ? "clone" : "edit"}-${edit?.id ?? "new"}`}
          clone={clone}
          item={edit}
          ingredients={ingredients.data}
          close={() => setEdit(undefined)}
          saved={() => {
            setEdit(undefined);
            setSuccess("Đã lưu công thức.");
            list.reload();
          }}
        />
      )}
      {list.data?.length === 0 && <p>Chưa có công thức</p>}
      {list.data && filtered.length === 0 && list.data.length > 0 && (
        <p>Không có món phù hợp bộ lọc.</p>
      )}
      <RecipeGrid model={model} />
      <div className="bl-admin-pagination">
        <button
          disabled={currentPage <= 1}
          onClick={() => setPage(currentPage - 1)}
        >
          Trang trước
        </button>
        <span>
          Trang {currentPage}/{totalPages}
        </span>
        <button
          disabled={currentPage >= totalPages}
          onClick={() => setPage(currentPage + 1)}
        >
          Trang sau
        </button>
      </div>
    </>
  );
}
