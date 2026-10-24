import type { Product } from "@/lib/products";
import ProductImage from "./ProductImage";

export default function MenuHero({ product }: { product?: Product }) {
  return (
    <section className="bl-hero" aria-labelledby="hero-heading">
      <div className="bl-hero-content">
        <span className="bl-eyebrow">
          Thoughtfully brewed • Ready for pickup
        </span>
        <h1 id="hero-heading">
          A quiet moment,
          <br />
          <em>rich in flavor.</em>
        </h1>
        <p>Freshly brewed every day. Pick up at the counter.</p>
        <a className="bl-button" href="#menu">
          Explore drinks
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m9 5 7 7-7 7" />
          </svg>
        </a>
      </div>
      <div className="bl-hero-image">
        {product ? (
          <>
            <ProductImage src={product.imageUrl} name={product.name} hero />
            <div className="bl-hero-note">
              <span aria-hidden="true">✦</span>
              <div>
                <small>BrewLite drinks</small>
                <strong>{product.name}</strong>
              </div>
            </div>
          </>
        ) : (
          <div className="bl-hero-decoration" aria-hidden="true">
            <span className="bl-decoration-ring" />
            <svg viewBox="0 0 240 240" fill="none">
              <path
                d="M66 98h108v39a47 47 0 0 1-47 47h-14a47 47 0 0 1-47-47V98Z"
                fill="#f7f3ed"
              />
              <path
                d="M174 108h10a24 24 0 1 1 0 48h-13"
                stroke="#f7f3ed"
                strokeWidth="9"
              />
              <path
                d="M92 66c-12-15 12-20 0-36m30 36c-12-15 12-20 0-36m30 36c-12-15 12-20 0-36"
                stroke="#d7bda5"
                strokeWidth="5"
                strokeLinecap="round"
              />
              <ellipse cx="120" cy="196" rx="74" ry="5" fill="#d7bda5" />
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}
