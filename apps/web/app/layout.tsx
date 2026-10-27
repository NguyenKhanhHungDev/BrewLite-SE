import type { Metadata } from "next";
import { DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";
import CartProvider from "@/components/CartProvider";
import AuthProvider from "@/components/AuthProvider";
import CheckoutProvider from "@/components/CheckoutProvider";
import BrewLiteHeader from "@/components/BrewLiteHeader";
import BrewLiteFooter from "@/components/BrewLiteFooter";

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  display: "swap",
  fallback: ["Arial", "sans-serif"],
});

const fraunces = Fraunces({
  subsets: ["latin", "vietnamese"],
  variable: "--font-fraunces",
  display: "swap",
  fallback: ["Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "BrewLite — Menu đồ uống",
  description: "Khám phá thực đơn BrewLite và lựa chọn đồ uống nhận tại quầy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${dmSans.variable} ${fraunces.variable}`}>
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
