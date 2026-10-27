import MenuCatalog from "@/components/MenuCatalog";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#menu">
        Đến thực đơn
      </a>
      <main>
        <MenuCatalog />
      </main>
    </>
  );
}
