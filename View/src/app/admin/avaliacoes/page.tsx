import Link from "next/link";
import { ReviewList } from "../../../components/ReviewList";

export default function AdminReviewsPage() {
  return (
    <main className="container-page min-h-[60vh] py-12">
      <Link
        href="/admin/pedidos"
        className="text-sm font-semibold text-berry underline"
      >
        ← Voltar aos pedidos
      </Link>
      <h1 className="section-title mt-4 font-bold">Avaliações recebidas</h1>
      <p className="mt-3 text-muted">
        Todas as avaliações, inclusive as não autorizadas para publicação.
        O acesso oficial pode apagar uma avaliação pelo detalhe.
      </p>
      <ReviewList admin />
    </main>
  );
}
