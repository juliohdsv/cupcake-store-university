"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { EmptyState, ErrorState } from "../../components/Feedback";
import { useCart } from "../../context/CartContext";
import { fetchProducts } from "../../lib/api";
import { brl } from "../../lib/format";
import type { Product } from "../../lib/schemas";

export default function CartPage() {
  const { items, ready, change, remove } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    fetchProducts({}, controller.signal)
      .then(setProducts)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar o carrinho.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);
  const lookup = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const subtotal = items.reduce(
    (sum, item) =>
      sum + (lookup.get(item.productId)?.priceCents ?? 0) * item.quantity,
    0,
  );
  const unavailable = items.some((item) => !lookup.has(item.productId));

  return (
    <main className="container-page min-h-[60vh] py-12">
      <h1 className="section-title font-bold">Seu carrinho</h1>
      <p className="mt-3 text-muted">
        Ajuste suas escolhas antes de informar a entrega.
      </p>
      {!ready || loading ? (
        <div className="skeleton mt-8 h-64 rounded-2xl" />
      ) : error ? (
        <div className="mt-8">
          <ErrorState
            message={error}
            retry={() => {
              setError("");
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Seu carrinho está vazio"
            description="Escolha um cupcake para começar."
            href="/"
            action="Ver cupcakes"
          />
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {items.map((item) => {
              const product = lookup.get(item.productId);
              return (
                <div
                  key={item.productId}
                  className="card flex flex-wrap items-center gap-4 p-4 sm:flex-nowrap"
                >
                  <div className="grid size-20 shrink-0 place-items-center rounded-xl bg-blush p-2">
                    {product && (
                      <Image
                        src={product.imagePath}
                        alt=""
                        width={80}
                        height={80}
                        className="size-full object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-bold">
                      {product?.name ?? "Cupcake indisponível"}
                    </h2>
                    <p className="text-sm text-muted">
                      {product
                        ? brl(product.priceCents)
                        : "Remova este item para continuar."}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-semibold">
                      Qtd.
                      <input
                        type="number"
                        min="1"
                        max="20"
                        step="1"
                        value={item.quantity}
                        className="input mt-1 w-20"
                        aria-label={`Quantidade de ${product?.name ?? "item indisponível"}`}
                        onChange={(event) => {
                          const value = Number(event.target.value);
                          if (Number.isInteger(value))
                            change(item.productId, value);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => remove(item.productId)}
                      className="min-h-11 rounded px-2 text-sm font-semibold text-berry hover:underline"
                      aria-label={`Remover ${product?.name ?? "item"}`}
                    >
                      Remover
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <aside className="card p-6">
            <h2 className="text-2xl font-bold">Resumo</h2>
            <div className="mt-5 flex justify-between">
              <span>Subtotal estimado</span>
              <strong>{brl(subtotal)}</strong>
            </div>
            <p className="mt-3 text-sm text-muted">
              Entrega fictícia fixa de R$ 8,90. O servidor confirma o total no
              checkout.
            </p>
            {unavailable ? (
              <p className="mt-5 text-sm font-semibold text-berry" role="alert">
                Remova itens indisponíveis antes de continuar.
              </p>
            ) : (
              <Link href="/checkout" className="btn-primary mt-6 w-full">
                Continuar para entrega
              </Link>
            )}
            <Link
              href="/"
              className="mt-4 block text-center text-sm font-semibold text-berry hover:underline"
            >
              Continuar escolhendo
            </Link>
          </aside>
        </div>
      )}
    </main>
  );
}
