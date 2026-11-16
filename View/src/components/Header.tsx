"use client";

import Link from "next/link";
import { useCart } from "../context/CartContext";

export function Header() {
  const { items, ready } = useCart();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  const demoPassword = process.env.NEXT_PUBLIC_DEMO_ADMIN_PASSWORD;
  return (
    <header className="sticky top-0 z-20 border-b border-sand bg-cream/95 backdrop-blur">
      <div className="container-page flex min-h-18 items-center justify-between gap-1 py-3 sm:gap-4">
        <Link
          href="/"
          className="flex items-center gap-2 whitespace-nowrap text-base font-bold tracking-tight text-cocoa sm:text-xl"
          aria-label="Doce e Afeto, início"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-full bg-berry text-white sm:size-9"
          >
            ✿
          </span>
          <span>
            Doce <span className="text-berry">&</span> Afeto
          </span>
        </Link>
        <nav
          aria-label="Navegação principal"
          className="flex shrink-0 items-center gap-1"
        >
          <Link
            href="/"
            aria-label="Cupcakes"
            title="Cupcakes"
            className="grid size-11 place-items-center rounded-xl text-cocoa hover:bg-blush hover:text-berry"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
            >
              <path d="M5 10h14l-1.4 10H6.4L5 10Z" />
              <path d="M4.5 10a2.5 2.5 0 0 1 2.3-3.4 3.6 3.6 0 0 1 5-2.8 3.6 3.6 0 0 1 5.4 2.8A2.5 2.5 0 0 1 19.5 10" />
              <path d="M10 13v4m4-4v4" />
            </svg>
          </Link>
          <Link
            href="/carrinho"
            aria-label={`Carrinho, ${ready ? count : 0} itens`}
            title="Carrinho"
            className="relative grid size-11 place-items-center rounded-xl text-cocoa hover:bg-blush hover:text-berry"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-6"
            >
              <path d="M2.5 4h2l2.3 11h11.8l2.2-8H5.2" />
              <circle cx="9" cy="19" r="1.3" />
              <circle cx="18" cy="19" r="1.3" />
            </svg>
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-berry px-1 text-[10px] font-bold text-white"
            >
              {ready ? count : 0}
            </span>
          </Link>
          <span className="group relative">
            <Link
              href="/admin"
              aria-label="Painel admin"
              aria-describedby={demoPassword ? "admin-demo-hint" : undefined}
              className="grid size-11 place-items-center rounded-xl text-cocoa hover:bg-blush hover:text-berry"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
              >
                <path d="m12 2 8 3v6c0 5-3.3 8.6-8 11-4.7-2.4-8-6-8-11V5l8-3Z" />
                <circle cx="12" cy="9" r="2" />
                <path d="M8.5 16a3.7 3.7 0 0 1 7 0" />
              </svg>
            </Link>
            {demoPassword && (
              <span
                id="admin-demo-hint"
                role="tooltip"
                className="pointer-events-none absolute right-0 top-full z-30 w-52 rounded-lg bg-cocoa px-3 py-2 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                Senha de demonstração: {demoPassword}
              </span>
            )}
          </span>
        </nav>
      </div>
    </header>
  );
}
