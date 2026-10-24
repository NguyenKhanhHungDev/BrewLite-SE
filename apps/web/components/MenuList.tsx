import type { Product } from "@/lib/products";
import ProductCard from "./ProductCard";

export type MenuState =
  | { status: "loading" }
  | { status: "success"; products: Product[] }
  | { status: "error" };

export default function MenuList({
  state,
  onRetry,
}: {
  state: MenuState;
  onRetry: () => void;
}) {
  return (
    <section
      className="bl-menu-section"
      id="menu"
      aria-labelledby="menu-heading"
      aria-busy={state.status === "loading"}
    >
      <div className="bl-section-heading">
        <div>
          <span className="bl-eyebrow">BrewLite drinks</span>
          <h2 id="menu-heading">Find your favorite</h2>
        </div>
        {state.status === "success" && state.products.length > 0 && (
          <p>{state.products.length} đồ uống</p>
        )}
      </div>
      {state.status === "loading" && (
        <>
          <p className="bl-loading-text" role="status">
            Đang tải sản phẩm...
          </p>
          <div className="bl-product-grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => (
              <div className="bl-skeleton" key={index}>
                <div />
                <span />
                <span />
              </div>
            ))}
          </div>
        </>
      )}
      {state.status === "error" && (
        <div className="bl-menu-state" role="alert">
          <span className="bl-state-symbol" aria-hidden="true">
            !
          </span>
          <h3>Không lấy được sản phẩm</h3>
          <p>Không tải được menu. Vui lòng thử lại.</p>
          <button className="bl-button" type="button" onClick={onRetry}>
            Thử lại <span aria-hidden="true">↻</span>
          </button>
        </div>
      )}
      {state.status === "success" && state.products.length === 0 && (
        <div className="bl-menu-state" role="status">
          <span className="bl-state-symbol" aria-hidden="true">
            ∅
          </span>
          <h3>Chưa có sản phẩm</h3>
          <p>Thực đơn sẽ hiển thị tại đây khi có sản phẩm.</p>
        </div>
      )}
      {state.status === "success" && state.products.length > 0 && (
        <ul className="bl-product-grid">
          {state.products.map((product) => (
            <li key={product.id}>
              <ProductCard product={product} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
