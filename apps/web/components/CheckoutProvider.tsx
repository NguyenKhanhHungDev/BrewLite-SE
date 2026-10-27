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
import { ApiError, isObject, requestJson } from "@/lib/api";
import { cartTotal, orderItems, parseCart, type CartLine } from "@/lib/cart";
import { parseProducts } from "@/lib/products";
import { parsePromoCode, previewPromotion } from "@/lib/promotion";
import {
  paidStatuses,
  parseHistory,
  parseOrderResult,
  parsePayment,
  type OrderRecord,
  type OrderResult,
  type PaymentBody,
  type PaymentMethod,
  type SimulateResult,
} from "@/lib/orders";
import { useAuth } from "./AuthProvider";
import { useCart } from "./CartProvider";

type Draft = {
  owner: number;
  key: string;
  snapshot: CartLine[];
  promoCode?: string;
};
type Purchase = Draft & OrderResult & { cartCleared: boolean };
type Attempt = { key: string; body: PaymentBody };
type State = {
  draft: Draft | null;
  purchase: Purchase | null;
  attempt: Attempt | null;
  ready: boolean;
  inputCode: string;
  appliedCode: string;
};
const empty: State = {
  draft: null,
  purchase: null,
  attempt: null,
  ready: false,
  inputCode: "",
  appliedCode: "",
};
type CheckoutApi = State & {
  busy: boolean;
  storageNotice: string;
  setPromoInput: (value: string) => void;
  applyPromo: () => void;
  removePromo: () => void;
  createOrder: (lines: CartLine[], promoCode?: string) => Promise<OrderResult>;
  pay: (method: PaymentMethod, result: SimulateResult) => Promise<OrderResult>;
  syncOrder: (order: OrderRecord) => void;
};
const Context = createContext<CheckoutApi | null>(null);

function parseDraft(value: unknown): Draft {
  if (
    !isObject(value) ||
    !Number.isSafeInteger(value.owner) ||
    Number(value.owner) < 1 ||
    typeof value.key !== "string" ||
    !value.key ||
    value.key.length > 200
  )
    throw new Error();
  const snapshot = parseCart(value.snapshot);
  if (!snapshot.length) throw new Error();
  const promoCode = parsePromoCode(value.promoCode);
  return {
    owner: Number(value.owner),
    key: value.key,
    snapshot,
    ...(promoCode ? { promoCode } : {}),
  };
}

function restore(value: unknown): State {
  if (!isObject(value)) throw new Error();
  const draft = value.draft === null ? null : parseDraft(value.draft);
  let purchase: Purchase | null = null;
  if (value.purchase !== null) {
    const saved = parseDraft(value.purchase);
    const order = parseOrderResult(value.purchase);
    if (
      !isObject(value.purchase) ||
      typeof value.purchase.cartCleared !== "boolean"
    )
      throw new Error();
    purchase = { ...saved, ...order, cartCleared: value.purchase.cartCleared };
  }
  let attempt: Attempt | null = null;
  if (value.attempt !== null) {
    const saved = value.attempt;
    if (
      !isObject(saved) ||
      typeof saved.key !== "string" ||
      !saved.key ||
      !isObject(saved.body) ||
      saved.body.orderId !== purchase?.orderId ||
      (saved.body.method !== "WALLET" && saved.body.method !== "CARD") ||
      (saved.body.simulateResult !== "SUCCESS" &&
        saved.body.simulateResult !== "FAILURE")
    )
      throw new Error();
    attempt = {
      key: saved.key,
      body: {
        orderId: Number(saved.body.orderId),
        method: saved.body.method,
        simulateResult: saved.body.simulateResult,
      },
    };
  }
  const appliedCode =
    value.appliedCode === undefined
      ? (draft?.promoCode ?? purchase?.promoCode ?? "")
      : value.appliedCode === ""
        ? ""
        : (parsePromoCode(value.appliedCode) ?? "");
  const inputCode = value.inputCode ?? appliedCode;
  if (typeof inputCode !== "string" || inputCode.length > 64) throw new Error();
  return { draft, purchase, attempt, ready: true, inputCode, appliedCode };
}

export default function CheckoutProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { logoutVersion } = useAuth();
  return <CheckoutStore key={logoutVersion}>{children}</CheckoutStore>;
}

function CheckoutStore({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>(empty);
  const [busy, setBusy] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const current = useRef(state);
  const processing = useRef(false);
  const { session, request } = useAuth();
  const { lines: cartLines, reconcile, completePurchase } = useCart();
  const commit = useCallback((next: State) => {
    current.current = next;
    setState(next);
    try {
      sessionStorage.setItem("brewlite-checkout", JSON.stringify(next));
    } catch {
      setStorageNotice(
        "Không lưu được bước thanh toán. Giữ trang này mở khi đang kiểm tra kết quả.",
      );
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    async function load() {
      await Promise.resolve();
      if (disposed) return;
      try {
        const saved = sessionStorage.getItem("brewlite-checkout");
        const next = saved
          ? restore(JSON.parse(saved))
          : { ...empty, ready: true };
        current.current = next;
        setState(next);
      } catch {
        commit({ ...empty, ready: true });
        setStorageNotice(
          "Không khôi phục được bước thanh toán. Hãy kiểm tra lịch sử đơn trước khi tạo đơn khác.",
        );
      }
    }
    void load();
    return () => {
      disposed = true;
    };
  }, [commit]);

  const syncOrder = useCallback(
    (order: OrderRecord) => {
      const saved = current.current.purchase;
      if (
        !saved ||
        saved.owner !== session?.userId ||
        order.id !== saved.orderId
      )
        return;
      const paid = paidStatuses.includes(order.status);
      commit({
        ...current.current,
        purchase: {
          ...saved,
          status: order.status,
          total: order.total,
          cartCleared: saved.cartCleared || paid,
        },
        attempt: paid ? null : current.current.attempt,
      });
      if (paid && !saved.cartCleared) completePurchase(saved.snapshot);
    },
    [session?.userId, commit, completePurchase],
  );

  function checkPromoEditable() {
    const { draft, purchase } = current.current;
    if (
      !current.current.ready ||
      processing.current ||
      draft ||
      (purchase &&
        purchase.owner === session?.userId &&
        !paidStatuses.includes(purchase.status) &&
        purchase.status !== "CANCELLED")
    ) {
      throw new Error("Không thể đổi mã cho yêu cầu đã gửi.");
    }
  }

  function setPromoInput(value: string) {
    checkPromoEditable();
    if (value.length > 64) throw new Error("Mã có tối đa 64 ký tự.");
    commit({ ...current.current, inputCode: value });
  }

  function applyPromo() {
    checkPromoEditable();
    const code = parsePromoCode(current.current.inputCode);
    if (!code) throw new Error("Nhập mã giảm giá.");
    const preview = previewPromotion(cartTotal(cartLines), code);
    if (preview.payable <= 0)
      throw new Error("Giỏ hàng phải có tổng tiền lớn hơn 0.");
    commit({ ...current.current, inputCode: code, appliedCode: code });
  }

  function removePromo() {
    checkPromoEditable();
    commit({ ...current.current, inputCode: "", appliedCode: "" });
  }

  async function createOrder(
    lines: CartLine[],
    promoCode?: string,
  ): Promise<OrderResult> {
    if (processing.current) throw new Error("Yêu cầu đang được xử lý.");
    if (!state.ready || !session)
      throw new Error("Vui lòng đăng nhập trước khi tạo đơn.");
    const existing = current.current.purchase;
    if (
      existing?.owner === session.userId &&
      ["PENDING", "PAYMENT_FAILED"].includes(existing.status)
    )
      return existing;
    processing.current = true;
    setBusy(true);
    try {
      let draft = current.current.draft;
      if (draft && draft.owner !== session.userId)
        throw new Error("Hãy đăng nhập đúng tài khoản đã gửi yêu cầu tạo đơn.");
      if (!draft) {
        const code = parsePromoCode(promoCode);
        const catalog = parseProducts(await requestJson("/products"));
        const checked = reconcile(catalog);
        if (checked.issues.length) throw new Error(checked.issues.join(" "));
        if (checked.priceChanged)
          throw new Error(
            "Giá đã cập nhật. Vui lòng kiểm tra tổng mới rồi xác nhận lại.",
          );
        if (
          !checked.lines.length ||
          !lines.length ||
          cartTotal(checked.lines) <= 0
        )
          throw new Error("Giỏ hàng phải có tổng tiền lớn hơn 0.");
        draft = {
          owner: session.userId,
          key: crypto.randomUUID(),
          snapshot: parseCart(checked.lines),
          ...(code ? { promoCode: code } : {}),
        };
        commit({ ...current.current, draft });
      }
      try {
        const data = await request("/orders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": draft.key,
          },
          body: JSON.stringify({
            items: orderItems(draft.snapshot),
            ...(draft.promoCode ? { promoCode: draft.promoCode } : {}),
          }),
        });
        const order = parseOrderResult(data);
        commit({
          ...current.current,
          ready: true,
          draft: null,
          purchase: { ...draft, ...order, cartCleared: false },
          attempt: null,
        });
        return order;
      } catch (error) {
        const inventoryConflict =
          error instanceof ApiError &&
          error.status === 409 &&
          error.message === "Tồn kho vừa thay đổi, hãy thử lại";

        if (inventoryConflict) {
          commit({ ...current.current, draft: null });
          throw new Error(
            "Tồn kho vừa thay đổi, đơn chưa được tạo. Hãy về giỏ kiểm tra món và số lượng rồi xác nhận lại.",
          );
        }

        if (
          error instanceof ApiError &&
          error.status >= 400 &&
          error.status < 500 &&
          error.status !== 401 &&
          error.status !== 409
        )
          commit({ ...current.current, draft: null });
        throw error;
      }
    } finally {
      processing.current = false;
      setBusy(false);
    }
  }

  async function pay(
    method: PaymentMethod,
    result: SimulateResult,
  ): Promise<OrderResult> {
    if (processing.current) throw new Error("Yêu cầu đang được xử lý.");
    const purchase = current.current.purchase;
    if (!session || !purchase || purchase.owner !== session.userId)
      throw new Error("Vui lòng đăng nhập đúng tài khoản của đơn hàng.");
    processing.current = true;
    setBusy(true);
    try {
      const orders = parseHistory(await request("/orders/me"));
      const latest = orders.find((order) => order.id === purchase.orderId);
      if (!latest) throw new Error("Không tìm thấy đơn hàng của bạn.");
      syncOrder(latest);
      if (paidStatuses.includes(latest.status))
        return {
          orderId: latest.id,
          status: latest.status,
          total: latest.total,
        };
      if (!["PENDING", "PAYMENT_FAILED"].includes(latest.status))
        throw new Error("Đơn không còn ở trạng thái được thanh toán.");
      if (latest.total !== purchase.total)
        throw new Error(
          "Tổng tiền trên máy chủ đã thay đổi. Hãy kiểm tra và xác nhận lại.",
        );
      const attempt = current.current.attempt ?? {
        key: crypto.randomUUID(),
        body: { orderId: purchase.orderId, method, simulateResult: result },
      };
      commit({ ...current.current, attempt });
      const data = await request("/payments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.key,
        },
        body: JSON.stringify(attempt.body),
      });
      const payment = parsePayment(data, purchase.orderId);
      const paid = payment.status === "PAID";
      commit({
        ...current.current,
        purchase: {
          ...purchase,
          status: payment.status,
          cartCleared: purchase.cartCleared || paid,
        },
        attempt: null,
      });
      if (paid && !purchase.cartCleared) completePurchase(purchase.snapshot);
      return {
        orderId: purchase.orderId,
        status: payment.status,
        total: latest.total,
      };
    } finally {
      processing.current = false;
      setBusy(false);
    }
  }

  return (
    <Context.Provider
      value={{
        ...state,
        busy,
        storageNotice,
        setPromoInput,
        applyPromo,
        removePromo,
        createOrder,
        pay,
        syncOrder,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function useCheckout() {
  const checkout = useContext(Context);
  if (!checkout) throw new Error("CheckoutProvider chưa được gắn vào layout.");
  return checkout;
}
