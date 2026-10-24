"use client";

import Image from "next/image";
import { useState } from "react";

export default function ProductImage({
  src,
  name,
  hero = false,
}: {
  src: string;
  name: string;
  hero?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const available = Boolean(src.trim()) && failedSrc !== src;
  return (
    <div
      className={`bl-product-media${available ? "" : " bl-product-media-fallback"}`}
    >
      <Image
        src={available ? src : "/images/drink-placeholder.svg"}
        alt={available ? name : `Ảnh minh họa thay thế cho ${name}`}
        width={900}
        height={1100}
        unoptimized
        loading={hero ? "eager" : "lazy"}
        onError={available ? () => setFailedSrc(src) : undefined}
      />
      {!available && (
        <span className="bl-image-caption">Ảnh đang cập nhật</span>
      )}
    </div>
  );
}
