"use client";

import Link from "next/link";
import { useCart } from "./CartProvider";
import { useAuth } from "./AuthProvider";

export default function HeaderActions() {
  const { lines, ready } = useCart();
  const { session, logout } = useAuth();
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <>
      <Link
        href="/cart"
        className="bl-menu-link"
        aria-label={`Giỏ hàng, ${ready ? count : 0} ly`}
      >
        Giỏ <span className="bl-cart-badge">{ready ? count : 0}</span>
      </Link>
      <Link href="/history" className="bl-menu-link">
        Đơn hàng
      </Link>
      {session ? (
        <button type="button" className="bl-menu-link" onClick={logout}>
          Đăng xuất
        </button>
      ) : (
        <Link href="/login" className="bl-menu-link">
          Đăng nhập
        </Link>
      )}
    </>
  );
}
