import Link from "next/link";
import type { Product } from "@/lib/products";
import ProductImage from "./ProductImage";

export default function ProductCard({ product }: { product: Product }) {
  return (
    <article className="bl-product-card">
      <div className="bl-product-image-wrap">
        <ProductImage src={product.imageUrl} name={product.name} />
        {product.stock === 0 && <span className="bl-soldout">Hết hàng</span>}
      </div>
      <div className="bl-product-info">
        <h3>{product.name}</h3>
        <p className="bl-product-price">
          {product.price.toLocaleString("vi-VN")} <span>VND</span>
        </p>
        <Link href={`/products/${product.id}`} className="bl-detail-link">
          Xem chi tiết
        </Link>
      </div>
    </article>
  );
}
