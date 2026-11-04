import type { Metadata } from "next";
import "./globals.css";
import CartProvider from "@/components/CartProvider";
import AuthProvider from "@/components/AuthProvider";
import CheckoutProvider from "@/components/CheckoutProvider";
import BrewLiteHeader from "@/components/BrewLiteHeader";
import BrewLiteFooter from "@/components/BrewLiteFooter";

export const metadata: Metadata = {
  title: "BrewLite — Menu đồ uống",
  description: "Khám phá thực đơn BrewLite và lựa chọn đồ uống nhận tại quầy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi">
      <body>
        <CartProvider>
          <AuthProvider>
            <CheckoutProvider>
              <div className="brewlite-app" id="top">
                <BrewLiteHeader />
                {children}
                <BrewLiteFooter />
              </div>
            </CheckoutProvider>
          </AuthProvider>
        </CartProvider>
      </body>
    </html>
  );
}
