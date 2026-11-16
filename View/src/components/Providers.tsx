"use client";

import type { ReactNode } from "react";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { CartProvider } from "../context/CartContext";
import { AdminAuthProvider } from "../context/AdminAuthContext";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      <AdminAuthProvider>{children}</AdminAuthProvider>
      <ToastContainer
        position="bottom-right"
        autoClose={3500}
        pauseOnHover={false}
        pauseOnFocusLoss={false}
      />
    </CartProvider>
  );
}
