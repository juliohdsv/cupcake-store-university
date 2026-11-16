"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorState } from "../../../components/Feedback";
import { useCart } from "../../../context/CartContext";
import { fetchProduct } from "../../../lib/api";
import { brl } from "../../../lib/format";
import type { Product } from "../../../lib/schemas";

export default function ProductPage() {
  const { slug } = useParams<{ slug: string }>();
  const { add } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchProduct(slug, controller.signal)
      .then(setProduct)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(
          reason instanceof Error ? reason.message : "Cupcake indisponível.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slug, retry]);

  return (
    <main className="container-page min-h-[60vh] py-10">
      <Link
        href="/"
        className="text-sm font-semibold text-berry hover:underline"
      >
        ← Voltar aos cupcakes
      </Link>
      {loading ? (
        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <div className="skeleton h-80 rounded-3xl" />
          <div className="skeleton h-80 rounded-3xl" />
        </div>
      ) : error ? (
        <div className="mt-8">
          <ErrorState
            message={error}
            retry={() => setRetry((value) => value + 1)}
          />
        </div>
      ) : (
        product && (
          <div className="mt-8 grid items-center gap-10 md:grid-cols-2">
            <div className="card grid min-h-80 place-items-center bg-blush p-8">
              <Image
                src={product.imagePath}
                alt={`Foto do cupcake ${product.name}`}
                width={900}
                height={900}
                className="max-h-80 w-full object-contain"
                priority
              />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-berry">
                {product.category}
              </p>
              <h1 className="section-title mt-3 font-bold">{product.name}</h1>
              <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
                {product.description}
              </p>
              <p className="mt-6 text-3xl font-bold">
                {brl(product.priceCents)}
              </p>
              <div className="mt-8 flex flex-wrap items-end gap-4">
                <label className="w-28 text-sm font-semibold">
                  Quantidade
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    className="input mt-2"
                    value={quantity}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isInteger(value) && value >= 1 && value <= 20)
                        setQuantity(value);
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => add(product.id, quantity)}
                >
                  Adicionar ao carrinho
                </button>
              </div>
              <p className="mt-5 text-sm text-muted">
                Valor final e disponibilidade são confirmados no pedido.
              </p>
            </div>
          </div>
        )
      )}
    </main>
  );
}
