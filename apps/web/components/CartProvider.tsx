"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  addCartLine,
  changeCartQuantity,
  parseCart,
  reconcileCart,
  subtractPurchased,
  type CartLine,
} from "@/lib/cart";
import type { Product } from "@/lib/products";
import type { Size, Topping } from "@/lib/pricing";

type CartApi = {
  lines: CartLine[];
  ready: boolean;
  notice: string;
  issues: string[];
  add: (
    product: Product,
    size: Size,
    toppings: Topping[],
    quantity: number,
  ) => void;
  changeQuantity: (key: string, quantity: number) => void;
  remove: (key: string) => void;
  clear: () => void;
  reconcile: (products: Product[]) => ReturnType<typeof reconcileCart>;
  completePurchase: (snapshot: CartLine[]) => void;
};
const Context = createContext<CartApi | null>(null);

export default function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState({
    lines: [] as CartLine[],
    ready: false,
    notice: "",
    issues: [] as string[],
  });
  const current = useRef(state);
  const commit = useCallback(
    (lines: CartLine[], notice = "", issues: string[] = []) => {
      let message = notice;
      try {
        localStorage.setItem("brewlite-cart", JSON.stringify(lines));
      } catch {
        message =
          "Trình duyệt không cho lưu giỏ. Giỏ hiện chỉ được giữ trong lần mở trang này.";
      }
      const next = { lines, ready: true, notice: message, issues };
      current.current = next;
      setState(next);
    },
    [],
  );

  useEffect(() => {
    let disposed = false;
    async function restore() {
      await Promise.resolve();
      if (disposed) return;
      try {
        const raw = localStorage.getItem("brewlite-cart");
        const next = {
          lines: raw ? parseCart(JSON.parse(raw)) : [],
          ready: true,
          notice: "",
          issues: [],
        };
        current.current = next;
        setState(next);
      } catch {
        commit([], "Dữ liệu giỏ đã lưu không hợp lệ. Vui lòng chọn lại món.");
      }
    }
    void restore();
    return () => {
      disposed = true;
    };
  }, [commit]);

  const add = useCallback(
    (product: Product, size: Size, toppings: Topping[], quantity: number) => {
      if (!current.current.ready)
        throw new Error("Đang khôi phục giỏ hàng, vui lòng chờ.");
      commit(
        addCartLine(current.current.lines, product, size, toppings, quantity),
      );
    },
    [commit],
  );
  const changeQuantity = useCallback(
    (key: string, quantity: number) => {
      commit(changeCartQuantity(current.current.lines, key, quantity));
    },
    [commit],
  );
  const remove = useCallback(
    (key: string) =>
      commit(current.current.lines.filter((line) => line.key !== key)),
    [commit],
  );
  const clear = useCallback(() => commit([]), [commit]);
  const reconcile = useCallback(
    (products: Product[]) => {
      const result = reconcileCart(current.current.lines, products);
      commit(
        result.lines,
        result.priceChanged
          ? "Giá sản phẩm đã thay đổi. Giỏ đã cập nhật giá mới; hãy kiểm tra trước khi tạo đơn."
          : current.current.notice,
        result.issues,
      );
      return result;
    },
    [commit],
  );
  const completePurchase = useCallback(
    (snapshot: CartLine[]) =>
      commit(subtractPurchased(current.current.lines, snapshot)),
    [commit],
  );

  return (
    <Context.Provider
      value={{
        ...state,
        add,
        changeQuantity,
        remove,
        clear,
        reconcile,
        completePurchase,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useCart() {
  const cart = useContext(Context);
  if (!cart) throw new Error("CartProvider chưa được gắn vào layout.");
  return cart;
}
