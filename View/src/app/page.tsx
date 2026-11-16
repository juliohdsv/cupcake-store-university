"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ErrorState, EmptyState, LoadingCards } from "../components/Feedback";
import { ProductCard } from "../components/ProductCard";
import { ReviewList } from "../components/ReviewList";
import { fetchProducts } from "../lib/api";
import type { Product } from "../lib/schemas";

const categories = ["Todos", "Chocolate", "Frutas", "Clássicos", "Especiais"];

export default function HomePage() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("Todos");
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const timer = setTimeout(
      () => {
        fetchProducts(
          { q, category: category === "Todos" ? undefined : category },
          controller.signal,
        )
          .then(setItems)
          .catch((reason: unknown) => {
            if (reason instanceof Error && reason.name === "AbortError") return;
            setError(
              reason instanceof Error
                ? reason.message
                : "Falha ao carregar cupcakes.",
            );
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      },
      q ? 250 : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [q, category, retry]);

  return (
    <main>
      <section className="overflow-hidden bg-blush">
        <div className="container-page grid min-h-96 items-center gap-8 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-4 text-sm font-bold uppercase tracking-[.22em] text-berry">
              Feitos para adoçar o dia
            </p>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              Pequenos doces.
              <br />
              <span className="text-berry">Grandes momentos.</span>
            </h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted">
              Escolha seus cupcakes favoritos, monte o carrinho e experimente
              todo o fluxo em um ambiente acadêmico de simulação.
            </p>
            <Link href="#catalogo" className="btn-primary mt-7">
              Explorar cupcakes
            </Link>
          </div>
          <div
            className="mx-auto size-64 overflow-hidden rounded-full bg-cream shadow-xl shadow-berry/10 sm:size-80"
            aria-hidden="true"
          >
            <Image
              src="/products/morango-creme.jpg"
              alt=""
              width={640}
              height={640}
              className="size-full object-cover"
              priority
            />
          </div>
        </div>
      </section>
      <section id="catalogo" className="container-page scroll-mt-28 py-16">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-widest text-berry">
              Nossa seleção
            </p>
            <h2 className="section-title font-bold">Escolha o seu favorito</h2>
          </div>
          <label className="w-full max-w-xs text-sm font-semibold text-muted">
            Buscar cupcake
            <input
              className="input mt-2"
              type="search"
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Nome do cupcake"
            />
          </label>
        </div>
        <div
          role="group"
          aria-label="Filtrar por categoria"
          className="mb-8 flex flex-wrap gap-2"
        >
          {categories.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setCategory(name)}
              aria-pressed={category === name}
              className={`min-h-11 rounded-full px-4 py-2 text-sm font-semibold ${category === name ? "bg-berry text-white" : "border border-sand bg-white text-cocoa hover:bg-blush"}`}
            >
              {name}
            </button>
          ))}
        </div>
        <div aria-live="polite">
          {loading ? (
            <LoadingCards />
          ) : error ? (
            <ErrorState
              message={error}
              retry={() => setRetry((value) => value + 1)}
            />
          ) : items.length === 0 ? (
            <EmptyState
              title="Nenhum cupcake encontrado"
              description="Tente outro nome ou escolha uma categoria diferente."
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          )}
        </div>
      </section>
      <section id="avaliacoes" className="border-t border-sand bg-white py-16">
        <div className="container-page">
          <p className="mb-2 text-sm font-bold uppercase tracking-widest text-berry">Experiências reais</p>
          <h2 className="section-title font-bold">Avaliações do site</h2>
          <p className="mt-3 text-muted">Veja o que as pessoas testaram nesta loja acadêmica.</p>
          <ReviewList preview />
        </div>
      </section>
    </main>
  );
}
