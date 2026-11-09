"use client";
import ProductImage from "@/components/ProductImage";
import { categories, type Category } from "@/lib/menu";
import { imageOptions } from "./recipes-config";
import { useRecipeForm, type RecipeFormProps } from "./useRecipeForm";
export default function RecipeForm(props: RecipeFormProps) {
  const { item, clone, ingredients, close } = props;
  const {
    name,
    setName,
    price,
    setPrice,
    imageUrl,
    setImage,
    active,
    setActive,
    category,
    setCategory,
    rows,
    setRows,
    error,
    busy,
    submit,
  } = useRecipeForm(props);
  return (
    <form
      className="bl-panel bl-admin-form"
      aria-label={
        clone ? "Sao chép công thức" : item ? "Sửa công thức" : "Thêm công thức"
      }
      onSubmit={submit}
    >
      <h2>
        {clone
          ? "Sao chép thành món mới"
          : item
            ? "Sửa công thức"
            : "Thêm công thức"}
      </h2>
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
          Danh mục
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value as Category)}
          >
            {categories.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
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
          Ảnh món
          <select
            required
            value={imageUrl}
            onChange={(e) => setImage(e.target.value)}
          >
            <option value="">Chọn ảnh</option>
            {!imageOptions.some(
              (name) => imageUrl === `/images/products/${name}.jpg`,
            ) &&
              imageUrl && <option value={imageUrl}>Ảnh hiện tại</option>}
            {imageOptions.map((name) => (
              <option key={name} value={`/images/products/${name}.jpg`}>
                {name.replaceAll("-", " ")}
              </option>
            ))}
          </select>
        </label>
        {imageUrl && (
          <div className="bl-admin-image-preview">
            <ProductImage src={imageUrl} name={name || "Ảnh xem trước"} />
          </div>
        )}
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
              Định lượng (
              {ingredients.find((i) => String(i.id) === row.ingredientId)
                ?.unit ?? "g/ml"}
              )
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
              disabled={rows.length <= 1}
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
