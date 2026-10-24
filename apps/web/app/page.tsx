import BrewLiteHeader from "@/components/BrewLiteHeader";
import BrewLiteFooter from "@/components/BrewLiteFooter";
import MenuCatalog from "@/components/MenuCatalog";

export default function Home() {
  return (
    <div className="brewlite-app" id="top">
      <a className="skip-link" href="#menu">
        Đến thực đơn
      </a>
      <BrewLiteHeader />
      <main>
        <MenuCatalog />
      </main>
      <BrewLiteFooter />
    </div>
  );
}
