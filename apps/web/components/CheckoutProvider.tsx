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
import { isKnownOrderConflict } from "@/lib/order-conflict";
import { cartTotal, orderItems, parseCart, type CartLine } from "@/lib/cart";
import { parseProducts } from "@/lib/products";
import { parsePromoCode, previewPromotion } from "@/lib/promotion";
import {
  paidStatuses,
  parseOrderResult,
  type OrderRecord,
  type OrderResult,
} from "@/lib/orders";
import {
  parsePaymentLink,
  parsePaymentStatus,
  paymentView,
  type PaymentStatus,
} from "@/lib/payments";
import { useAuth } from "./AuthProvider";
import { useCart } from "./CartProvider";

type Draft = {
  owner: number;
  key: string;
  snapshot: CartLine[];
  recipientName: string;
  promoCode?: string;
};
type Purchase = Draft & OrderResult & { cartCleared: boolean };
type Attempt = { key: string; orderId: number; provider: "ZALOPAY" | "LEGACY" };
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
  createOrder: (
    lines: CartLine[],
    recipientName: string,
    promoCode?: string,
  ) => Promise<OrderResult>;
  startPayment: () => Promise<string>;
  beginNewOrder: () => void;
  syncPayment: (status: PaymentStatus) => void;
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
  // Old session drafts may not contain these fields; keep them editable so the
  // user can complete the new recipient step without corrupting saved state.
  const recipientName = typeof value.recipientName === "string" ? value.recipientName : "";
  if (recipientName.length > 100) throw new Error();
  return {
    owner: Number(value.owner),
    key: value.key,
    snapshot,
    recipientName,
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
      saved.key.length > 200
    )
      throw new Error();
    const body = isObject(saved.body) ? saved.body : null;
    const legacy = body !== null;
    const orderId = body ? body.orderId : saved.orderId;
    if (
      orderId !== purchase?.orderId ||
      (!legacy && saved.provider !== "ZALOPAY" && saved.provider !== "LEGACY")
    )
      throw new Error();
    attempt = {
      key: saved.key,
      orderId: Number(orderId),
      provider: legacy ? "LEGACY" : (saved.provider as Attempt["provider"]),
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

  const syncPayment = useCallback(
    (status: PaymentStatus) => {
      const saved = current.current.purchase;
      if (
        !saved ||
        saved.owner !== session?.userId ||
        saved.orderId !== status.orderId
      )
        return;
      if (status.latestPayment && status.latestPayment.amount !== saved.total) {
        throw new Error("Số tiền thanh toán không khớp đơn hàng.");
      }
      const paid = paymentView(status) === "success";
      if (saved.status === status.orderStatus && (!paid || saved.cartCleared))
        return;
      commit({
        ...current.current,
        purchase: {
          ...saved,
          status: status.orderStatus,
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
        purchase.status === "PENDING")
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
    recipientNameInput: string,
    promoCode?: string,
  ): Promise<OrderResult> {
    if (processing.current) throw new Error("Yêu cầu đang được xử lý.");
    if (!state.ready || !session)
      throw new Error("Vui lòng đăng nhập trước khi tạo đơn.");
    const existing = current.current.purchase;
    if (existing?.owner === session.userId && existing.status === "PENDING")
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
        const recipientName = recipientNameInput.trim();
        if (recipientName.length < 2 || recipientName.length > 100)
          throw new Error("Tên người nhận phải có từ 2 đến 100 ký tự.");
        draft = {
          owner: session.userId,
          key: crypto.randomUUID(),
          snapshot: parseCart(checked.lines),
          recipientName,
          ...(code ? { promoCode: code } : {}),
        };
        commit({ ...current.current, draft });
      } else if (!draft.recipientName) {
        // A draft saved by an older frontend can be restored without the
        // recipient step. Complete it while preserving its idempotency key.
        const recipientName = recipientNameInput.trim();
        if (recipientName.length < 2 || recipientName.length > 100)
          throw new Error("Tên người nhận phải có từ 2 đến 100 ký tự.");
        draft = { ...draft, recipientName };
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
            recipientName: draft.recipientName,
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
        if (isKnownOrderConflict(error)) {
          commit({ ...current.current, draft: null });
          throw new Error(
            "Giá hoặc tồn kho vừa thay đổi, đơn chưa được tạo. Hãy về giỏ kiểm tra rồi xác nhận lại.",
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

  function beginNewOrder() {
    if (processing.current) return;
    // Only reset this browser checkout; old gateway attempts remain available
    // in order history and continue to reconcile on the backend.
    commit({ ...empty, ready: true });
  }

  async function startPayment(): Promise<string> {
    if (processing.current) throw new Error("Yêu cầu đang được xử lý.");
    const purchase = current.current.purchase;
    if (!session || !purchase || purchase.owner !== session.userId)
      throw new Error("Vui lòng đăng nhập đúng tài khoản của đơn hàng.");
    if (purchase.status !== "PENDING")
      throw new Error("Đơn không còn ở trạng thái được thanh toán.");
    processing.current = true;
    setBusy(true);
    try {
      const status = parsePaymentStatus(
        await request(`/payments/${purchase.orderId}/status`),
        purchase.orderId,
      );
      syncPayment(status);
      if (
        status.orderStatus !== "PENDING" ||
        paymentView(status) !== "pending"
      ) {
        throw new Error("Đơn đã có kết quả. Hãy xem trạng thái thanh toán.");
      }
      const savedAttempt = current.current.attempt;
      if (
        savedAttempt?.provider === "LEGACY" ||
        (status.latestPayment &&
          (!savedAttempt || status.latestPayment.provider !== "ZALOPAY"))
      ) {
        throw new Error(
          "Đơn đang có giao dịch trước đó. Hãy kiểm tra trạng thái trước khi thanh toán lại.",
        );
      }
      const attempt: Attempt = savedAttempt ?? {
        key: crypto.randomUUID(),
        orderId: purchase.orderId,
        provider: "ZALOPAY",
      };
      // Persist before sending; network errors and refresh must reuse the same key.
      commit({ ...current.current, attempt });
      const response = await request("/payments/zalopay/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": attempt.key,
        },
        body: JSON.stringify({ orderId: purchase.orderId }),
      });
      return parsePaymentLink(response, purchase.orderId).paymentUrl;
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
        startPayment,
        beginNewOrder,
        syncPayment,
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
