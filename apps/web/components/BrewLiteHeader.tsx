import React from "react";
import Link from "next/link";
import BrewLiteMark from "./BrewLiteMark";
import HeaderActions from "./HeaderActions";

export default function BrewLiteHeader() {
  return (
    <header className="bl-header" role="banner">
      <div className="bl-header-inner">
        <Link className="bl-brand" href="/" aria-label="BrewLite — Trang chủ thực đơn">
          <BrewLiteMark />
          <div className="bl-brand-text">
            <span className="bl-brand-name">BrewLite</span>
            <span className="bl-brand-tagline">Artisan Coffee & Tea</span>
          </div>
        </Link>
        <nav className="bl-nav" aria-label="Điều hướng chính">
          <Link className="bl-menu-link bl-nav-explore" href="/#menu">
            <span>Thực đơn</span>
          </Link>
          <HeaderActions />
        </nav>
      </div>
    </header>
  );
}
