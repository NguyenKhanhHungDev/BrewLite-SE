"use client";
import { useRef, useState, type FormEvent } from "react";
import { useAuth } from "../AuthProvider";
import { parseRecipes, type Recipe } from "@/lib/recipes";
import { parseIngredients, type Ingredient } from "@/lib/ingredients";
import { money } from "@/lib/pricing";
import { useAdminList } from "./useAdminList";
import ProductImage from "../ProductImage";
export default function RecipeManager() {
  const list = useAdminList("/recipes", parseRecipes),
    ingredients = useAdminList("/ingredients", parseIngredients);
  const [edit, setEdit] = useState<Recipe | null | undefined>(undefined),
    [success, setSuccess] = useState("");
  return (
    <>
      <div className="bl-admin-title">
        <h1>Công thức</h1>
        <button
          className="bl-button"
          disabled={!ingredients.data?.length}
          onClick={() => {
            setSuccess("");
            setEdit(null);
          }}
        >
          Thêm món
        </button>
      </div>
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
          key={edit?.id ?? "new"}
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
      <div className="bl-admin-cards">
        {list.data?.map((item) => (
          <section className="bl-panel" key={item.id}>
            <div className="bl-product-image-wrap">
              <ProductImage src={item.imageUrl} name={item.name} />
            </div>
            <h2>{item.name}</h2>
            <p>
              {money(item.price)} · {item.isActive ? "Đang bán" : "Ngừng bán"}
            </p>
            <details>
              <summary>Nguyên liệu size M</summary>
              <ul>
                {item.ingredients.map((row) => (
                  <li key={row.ingredientId}>
                    {row.name}: {row.quantity} {row.unit}
                  </li>
                ))}
              </ul>
            </details>
            <button
              disabled={!ingredients.data?.length}
              onClick={() => {
                setSuccess("");
                setEdit(item);
              }}
            >
              Sửa
            </button>
          </section>
        ))}
      </div>
    </>
  );
}
function RecipeForm({
  item,
  ingredients,
  close,
  saved,
}: {
  item: Recipe | null;
  ingredients: Ingredient[];
  close: () => void;
  saved: () => void;
}) {
  const { request } = useAuth();
  const [name, setName] = useState(item?.name ?? ""),
    [price, setPrice] = useState(String(item?.price ?? "")),
    [imageUrl, setImage] = useState(item?.imageUrl ?? ""),
    [active, setActive] = useState(item?.isActive ?? true);
  const [rows, setRows] = useState(
    item?.ingredients.map((row) => ({
      ingredientId: String(row.ingredientId),
      quantity: String(row.quantity),
    })) ?? [{ ingredientId: "", quantity: "" }],
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const pending = useRef(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    try {
      if (
        !name.trim() ||
        !Number.isInteger(Number(price)) ||
        Number(price) <= 0 ||
        Number(price) > 2147483647
      )
        throw new Error("Tên hoặc giá không hợp lệ.");
      if (
        !/^\/images\/products\/[a-z0-9]+(?:-[a-z0-9]+)*\.jpg$/.test(
          imageUrl.trim(),
        )
      )
        throw new Error("Ảnh cần có dạng /images/products/ten-mon.jpg.");
      const selected = rows.map((row) => ({
        ingredientId: Number(row.ingredientId),
        quantity: Number(row.quantity),
      }));
      if (
        !selected.length ||
        new Set(selected.map((row) => row.ingredientId)).size !==
          selected.length ||
        selected.some(
          (row) =>
            !ingredients.some((i) => i.id === row.ingredientId) ||
            !Number.isInteger(row.quantity) ||
            row.quantity <= 0 ||
            row.quantity > 2147483647,
        )
      )
        throw new Error(
          "Chọn nguyên liệu không trùng và định lượng nguyên dương.",
        );
      await request(item ? `/recipes/${item.id}` : "/recipes", {
        method: item ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          price: Number(price),
          imageUrl: imageUrl.trim(),
          isActive: active,
          ingredients: selected,
        }),
      });
      saved();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không lưu được công thức.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form className="bl-panel bl-admin-form" onSubmit={submit}>
      <h2>{item ? "Sửa công thức" : "Thêm công thức"}</h2>
      <fieldset disabled={busy}>
        <label>
          Tên món
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label>
          Giá size M
          <input
            type="number"
            min="1"
            step="1"
            required
            value={price}
            onChange={(e) => setPrice(e.target.value)}
          />
        </label>
        <label>
          Đường dẫn ảnh
          <input
            required
            placeholder="/images/products/ca-phe-sua.jpg"
            value={imageUrl}
            onChange={(e) => setImage(e.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
          />{" "}
          Đang bán
        </label>
        <h3>Định lượng size M</h3>
        {rows.map((row, index) => (
          <div className="bl-admin-recipe-row" key={index}>
            <label>
              Nguyên liệu
              <select
                required
                value={row.ingredientId}
                onChange={(e) =>
                  setRows(
                    rows.map((r, i) =>
                      i === index ? { ...r, ingredientId: e.target.value } : r,
                    ),
                  )
                }
              >
                <option value="">Chọn nguyên liệu</option>
                {ingredients.map((i) => (
                  <option
                    key={i.id}
                    value={i.id}
                    disabled={rows.some(
                      (r, j) => j !== index && r.ingredientId === String(i.id),
                    )}
                  >
                    {i.name} ({i.unit})
                  </option>
                ))}
              </select>
            </label>
            <label>
              Định lượng
              <input
                type="number"
                min="1"
                step="1"
                required
                value={row.quantity}
                onChange={(e) =>
                  setRows(
                    rows.map((r, i) =>
                      i === index ? { ...r, quantity: e.target.value } : r,
                    ),
                  )
                }
              />
            </label>
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, i) => i !== index))}
            >
              Xóa dòng
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setRows([...rows, { ingredientId: "", quantity: "" }])}
        >
          Thêm nguyên liệu
        </button>
        {error && <p role="alert">{error}</p>}
        <div className="bl-actions">
          <button className="bl-button" type="submit">
            {busy ? "Đang lưu…" : "Lưu công thức"}
          </button>
          <button type="button" onClick={close}>
            Đóng
          </button>
        </div>
      </fieldset>
    </form>
  );
}
