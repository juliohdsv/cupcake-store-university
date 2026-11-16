"use client";

import Image from "next/image";
import Link from "next/link";
import { useCart } from "../context/CartContext";
import { brl } from "../lib/format";
import type { Product } from "../lib/schemas";

export function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  return (
    <article className="card flex min-w-0 flex-col overflow-hidden transition-transform hover:-translate-y-1">
      <Link
        href={`/produtos/${product.slug}`}
        className="block overflow-hidden bg-blush"
        aria-label={`Ver ${product.name}`}
      >
        <Image
          src={product.imagePath}
          alt={`Foto do cupcake ${product.name}`}
          width={900}
          height={900}
          className="aspect-square w-full object-cover"
        />
      </Link>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-berry">
          {product.category}
        </p>
        <h3 className="mt-2 text-xl font-bold">
          <Link href={`/produtos/${product.slug}`} className="hover:text-berry">
            {product.name}
          </Link>
        </h3>
        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted">
          {product.description}
        </p>
        <div className="mt-5 flex items-center justify-between gap-2">
          <strong className="text-xl text-cocoa">
            {brl(product.priceCents)}
          </strong>
          <button
            type="button"
            onClick={() => add(product.id)}
            className="btn-primary text-sm"
            aria-label={`Adicionar ${product.name} ao carrinho`}
          >
            Adicionar
          </button>
        </div>
      </div>
    </article>
  );
}
