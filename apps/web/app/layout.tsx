import type { Metadata } from "next";
import "./globals.css";
import CartProvider from "@/components/CartProvider";
import AuthProvider from "@/components/AuthProvider";
import CheckoutProvider from "@/components/CheckoutProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";
import BrewLiteHeader from "@/components/BrewLiteHeader";
import BrewLiteFooter from "@/components/BrewLiteFooter";

export const metadata: Metadata = {
  title: "BrewLite — Cà phê thủ công & Thức uống tại quầy",
  description:
    "Khám phá thực đơn cà phê rang mộc, trà trái cây tươi mát và đặt món nhận nhanh tại quầy cùng BrewLite.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>
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
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
