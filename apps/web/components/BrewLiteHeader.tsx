import BrewLiteMark from "./BrewLiteMark";

export default function BrewLiteHeader() {
  return (
    <header className="bl-header">
      <div className="bl-header-inner">
        <a className="bl-brand" href="#top" aria-label="BrewLite — đầu trang">
          <BrewLiteMark />
          <span>BrewLite</span>
        </a>
        <nav aria-label="Điều hướng chính">
          <a className="bl-menu-link" href="#menu">
            Thực đơn <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </div>
    </header>
  );
}
