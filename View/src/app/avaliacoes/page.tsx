import Link from "next/link";
import { ReviewList } from "../../components/ReviewList";

export default function ReviewsPage() {
  return (
    <main className="container-page min-h-[60vh] py-12">
      <Link href="/" className="text-sm font-semibold text-berry underline">
        ← Voltar à loja
      </Link>
      <h1 className="section-title mt-4 font-bold">Avaliações do site</h1>
      <p className="mt-3 text-muted">
        Comentários de pessoas que autorizaram a publicação.
      </p>
      <ReviewList />
    </main>
  );
}
