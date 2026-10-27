import BrewLiteMark from "./BrewLiteMark";
import Link from "next/link";
import HeaderActions from "./HeaderActions";

export default function BrewLiteHeader() {
  return (
    <header className="bl-header">
      <div className="bl-header-inner">
        <Link className="bl-brand" href="/" aria-label="BrewLite — đầu trang">
          <BrewLiteMark />
          <span>BrewLite</span>
        </Link>
        <nav aria-label="Điều hướng chính">
          <Link className="bl-menu-link" href="/#menu">
            Menu
          </Link>
          <HeaderActions />
        </nav>
      </div>
    </header>
  );
}
