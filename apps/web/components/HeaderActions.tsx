"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "./CartProvider";
import { useAuth } from "./AuthProvider";
import { useTheme } from "./ThemeProvider";
import CartDrawer from "./CartDrawer";
import { ShoppingBagIcon, SunIcon, MoonIcon } from "./Icons";

export default function HeaderActions() {
  const { lines, ready } = useCart();
  const { session, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <>
      <div className="bl-header-actions">
        {/* Theme toggle */}
        <button
          type="button"
          className="bl-icon-button"
          onClick={toggleTheme}
          aria-label={
            resolvedTheme === "dark"
              ? "Chuyển sang giao diện sáng"
              : "Chuyển sang giao diện tối"
          }
          title={
            resolvedTheme === "dark" ? "Giao diện sáng" : "Giao diện tối"
          }
        >
          {resolvedTheme === "dark" ? (
            <SunIcon size={19} className="bl-theme-icon" />
          ) : (
            <MoonIcon size={19} className="bl-theme-icon" />
          )}
        </button>

        {/* Quick Cart Drawer Trigger */}
        <button
          type="button"
          className="bl-menu-link bl-cart-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label={`Giỏ hàng, ${ready ? count : 0} ly`}
          aria-haspopup="dialog"
        >
          <ShoppingBagIcon size={19} />
          <span className="bl-cart-btn-label">Giỏ hàng</span>
          <span className={`bl-cart-badge ${count > 0 ? "bl-badge-bump" : ""}`}>
            {ready ? count : 0}
          </span>
        </button>

        {/* Orders link */}
        <Link href="/history" className="bl-menu-link">
          <span>Đơn hàng</span>
        </Link>

        {/* Account profile link */}
        {session && (
          <Link href="/account" className="bl-menu-link">
            <span>Tài khoản</span>
          </Link>
        )}

        {/* Auth status */}
        {session ? (
          <div className="bl-user-nav">
            <button
              type="button"
              className="bl-menu-link bl-logout-btn"
              onClick={logout}
            >
              <span>Đăng xuất</span>
            </button>
          </div>
        ) : (
          <Link href="/login" className="bl-menu-link bl-login-btn">
            <span>Đăng nhập</span>
          </Link>
        )}
      </div>

      <CartDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
