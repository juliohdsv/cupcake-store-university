"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { ErrorState } from "./Feedback";
import { Stars } from "./ReviewList";
import { useAdminAuth } from "../context/AdminAuthContext";
import { ApiError, deleteAdminReview, fetchSiteReview } from "../lib/api";
import type { SavedSiteReview } from "../lib/schemas";

const fields = [
  ["worked", "O que testou e funcionou"],
  ["failed", "O que testou e não funcionou (e o que deve ser corrigido)"],
  ["notTested", "O que não testou (e por quê)"],
  ["suggestions", "Sugestões de melhoria"],
] as const;

export function ReviewDetail({ admin = false }: { admin?: boolean }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { status, role, markExpired } = useAdminAuth();
  const [review, setReview] = useState<SavedSiteReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { if (admin && status === "unauthenticated") router.replace("/admin"); }, [admin, status, router]);
  useEffect(() => {
    if (admin && status !== "authenticated") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchSiteReview(id, admin, controller.signal).then(setReview).catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === "AbortError") return;
      if (admin && reason instanceof ApiError && reason.code === "UNAUTHORIZED") { markExpired(); return; }
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar a avaliação.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [id, admin, status, retry, markExpired]);

  const back = admin ? "/admin/avaliacoes" : "/avaliacoes";
  async function removeReview() {
    if (!review || !window.confirm(`Apagar definitivamente a avaliação de ${review.reviewerName}?`)) return;
    setDeleting(true);
    try {
      await deleteAdminReview(review.id);
      toast.success("Avaliação apagada.");
      router.push("/admin/avaliacoes");
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "UNAUTHORIZED") { markExpired(); return; }
      toast.error(reason instanceof Error ? reason.message : "Não foi possível apagar a avaliação.");
    } finally { setDeleting(false); }
  }
  return <main className="container-page min-h-[60vh] py-12">
    <Link href={back} className="text-sm font-semibold text-berry underline">← Voltar às avaliações</Link>
    {loading || (admin && status !== "authenticated") ? <div className="skeleton mt-6 h-96 rounded-2xl" />
      : error ? <div className="mt-6"><ErrorState message={error} retry={() => setRetry((value) => value + 1)} /></div>
        : review && <article className="card mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-sm font-bold uppercase tracking-widest text-berry">Avaliação do site</p>
              <h1 className="section-title mt-2 font-bold">{review.reviewerName}</h1>
              <p className="mt-2 text-muted">Teste em {new Date(`${review.testDate}T12:00:00`).toLocaleDateString("pt-BR")}</p></div>
            <div><p className="mb-1 text-sm font-semibold">Nota geral</p><Stars rating={review.rating} /></div>
          </div>
          {admin && <p className="mt-4 text-sm text-muted">Publicação: {review.publicationConsent ? "autorizada" : "não autorizada"}</p>}
          <div className="mt-8 grid gap-6">{fields.map(([key, label]) => <section key={key}>
            <h2 className="text-xl font-bold">{label}</h2>
            <p className="mt-2 whitespace-pre-wrap text-muted">{review[key] || "Não informado."}</p>
          </section>)}</div>
          <section className="mt-8"><h2 className="text-xl font-bold">Captura de tela</h2>
            {review.screenshotDataUrl ? <Image src={review.screenshotDataUrl} alt={`Captura de tela enviada por ${review.reviewerName}`}
              width={1000} height={700} unoptimized className="mt-3 h-auto max-h-[70vh] w-auto max-w-full rounded-xl border border-sand object-contain" />
              : <p className="mt-2 text-muted">Não enviada.</p>}</section>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-sand pt-4">
            <p className="text-xs text-muted">Enviada em {new Date(review.createdAt).toLocaleString("pt-BR")}. Os campos não podem ser editados.</p>
            {admin && role === "OWNER" && <button type="button" onClick={() => void removeReview()} disabled={deleting}
              className="btn-secondary border-red-300 text-red-700 hover:bg-red-50">{deleting ? "Apagando..." : "Apagar avaliação"}</button>}
          </div>
        </article>}
  </main>;
}
