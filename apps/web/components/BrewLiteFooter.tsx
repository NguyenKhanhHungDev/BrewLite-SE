import BrewLiteMark from "./BrewLiteMark";

export default function BrewLiteFooter() {
  return (
    <footer className="bl-footer">
      <div className="bl-footer-inner">
        <div className="bl-brand bl-footer-brand">
          <BrewLiteMark />
          <span>BrewLite</span>
        </div>
        <p>Freshly brewed coffee for a better day.</p>
      </div>
      <div className="bl-footer-bottom">© 2026 BrewLite Coffee</div>
    </footer>
  );
}
