"use client";

import { useEffect, useState } from "react";
import { parseProducts } from "@/lib/products";
import MenuHero from "./MenuHero";
import MenuList, { type MenuState } from "./MenuList";

export default function MenuCatalog() {
  const [state, setState] = useState<MenuState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = window.setTimeout(() => controller.abort(), 15_000);
    async function load() {
      try {
        const response = await fetch("/products", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Products HTTP ${response.status}`);
        const products = parseProducts(await response.json());
        if (!disposed) setState({ status: "success", products });
      } catch {
        if (!disposed) setState({ status: "error" });
      } finally {
        window.clearTimeout(timeout);
      }
    }
    void load();
    return () => {
      disposed = true;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [attempt]);
  function retry() {
    setState({ status: "loading" });
    setAttempt((previous) => previous + 1);
  }
  return (
    <>
      <MenuHero
        product={state.status === "success" ? state.products[0] : undefined}
      />
      <MenuList state={state} onRetry={retry} />
    </>
  );
}
