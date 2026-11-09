import ProductDetail from "@/components/ProductDetail";
import { Suspense } from "react";

export default function ProductPage() {
  return (
    <Suspense fallback={<p role="status">Đang tải chi tiết sản phẩm...</p>}>
      <ProductDetail />
    </Suspense>
  );
}
