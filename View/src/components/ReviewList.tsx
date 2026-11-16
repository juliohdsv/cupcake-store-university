"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmptyState, ErrorState } from "./Feedback";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ApiError, fetchSiteReviews } from "../lib/api";
import type { SavedSiteReview } from "../lib/schemas";

export function Stars({ rating }: { rating: number }) {
  return <span aria-label={`${rating} de 5 estrelas`} className="text-xl tracking-wider text-berry" role="img">
    {"★".repeat(rating)}<span className="text-sand">{"☆".repeat(5 - rating)}</span>
  </span>;
}

export function ReviewList({ admin = false, preview = false }: { admin?: boolean; preview?: boolean }) {
  const router = useRouter();
  const { status, markExpired } = useAdminAuth();
  const [items, setItems] = useState<SavedSiteReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const refresh = () => setRetry((value) => value + 1);
    window.addEventListener("site-review-sent", refresh);
    return () => window.removeEventListener("site-review-sent", refresh);
  }, []);

  useEffect(() => { if (admin && status === "unauthenticated") router.replace("/admin"); }, [admin, status, router]);
  useEffect(() => {
    if (admin && status !== "authenticated") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchSiteReviews(admin, controller.signal).then(setItems).catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (admin && reason instanceof ApiError && reason.code === "UNAUTHORIZED") { markExpired(); return; }
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar avaliações.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [admin, status, retry, markExpired]);

  const visible = preview ? items.slice(0, 3) : items;
  return <div aria-live="polite">
    {loading || (admin && status !== "authenticated") ? <div className="skeleton mt-6 h-60 rounded-2xl" />
      : error ? <ErrorState message={error} retry={() => setRetry((value) => value + 1)} />
        : visible.length === 0 ? preview
          ? <p className="mt-6 flex min-h-40 items-center justify-center text-center text-muted" role="status">Sem avaliações.</p>
          : <EmptyState title="Ainda não há avaliações para mostrar" description={admin ? "As avaliações enviadas aparecerão aqui." : "As avaliações autorizadas para publicação aparecerão aqui."} />
          : <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{visible.map((review) => <Link key={review.id}
            href={`${admin ? "/admin" : ""}/avaliacoes/${review.id}`} className="card overflow-hidden transition-shadow hover:shadow-lg focus-visible:outline-berry"
            aria-label={`Ver avaliação completa de ${review.reviewerName}`}>
            {review.screenshotDataUrl ? <Image src={review.screenshotDataUrl} alt={`Captura de tela enviada por ${review.reviewerName}`}
              width={640} height={360} unoptimized className="h-40 w-full border-b border-sand object-cover" />
              : <div className="grid h-40 place-items-center bg-blush text-5xl text-berry" aria-hidden="true">★</div>}
            <div className="p-5">
              <Stars rating={review.rating} />
              <p className="mt-2 line-clamp-3 min-h-16 text-cocoa">{review.worked || review.failed || review.suggestions || review.notTested || "Avaliação sem comentário."}</p>
              <p className="mt-3 text-sm font-semibold text-muted">{review.reviewerName} · {new Date(`${review.testDate}T12:00:00`).toLocaleDateString("pt-BR")}</p>
              {admin && !review.publicationConsent && <span className="mt-2 inline-block rounded-full bg-blush px-3 py-1 text-xs font-semibold text-berry">Privada</span>}
            </div>
          </Link>)}</div>}
    {preview && visible.length > 0 && <Link href="/avaliacoes" className="btn-secondary mt-6">Ver todas as avaliações</Link>}
  </div>;
}
