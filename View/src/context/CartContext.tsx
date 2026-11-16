"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { toast } from "react-toastify";

export interface CartItem {
  productId: string;
  quantity: number;
}
interface CartContextValue {
  items: CartItem[];
  ready: boolean;
  add: (productId: string, quantity?: number) => void;
  change: (productId: string, quantity: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const storageKey = "pit-cupcakes-carrinho";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(
        localStorage.getItem(storageKey) ?? "[]",
      );
      if (Array.isArray(stored))
        setItems(
          stored.filter(
            (item): item is CartItem =>
              typeof item === "object" &&
              item !== null &&
              typeof item.productId === "string" &&
              Number.isInteger(item.quantity) &&
              item.quantity >= 1 &&
              item.quantity <= 20,
          ),
        );
    } catch {
      /* Carrinho local inválido: iniciar vazio. */
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(items));
  }, [items, ready]);

  const add = useCallback((productId: string, quantity = 1) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return;
    setItems((current) => {
      const existing = current.find((item) => item.productId === productId);
      return existing
        ? current.map((item) =>
            item.productId === productId
              ? { ...item, quantity: Math.min(20, item.quantity + quantity) }
              : item,
          )
        : [...current, { productId, quantity }];
    });
    toast.success("Cupcake adicionado ao carrinho.");
  }, []);
  const change = useCallback((productId: string, quantity: number) => {
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return;
    setItems((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity } : item,
      ),
    );
  }, []);
  const remove = useCallback(
    (productId: string) =>
      setItems((current) =>
        current.filter((item) => item.productId !== productId),
      ),
    [],
  );
  const clear = useCallback(() => setItems([]), []);
  const value = useMemo(
    () => ({ items, ready, add, change, remove, clear }),
    [items, ready, add, change, remove, clear],
  );
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const cart = useContext(CartContext);
  if (!cart) throw new Error("Carrinho fora do provedor.");
  return cart;
}
