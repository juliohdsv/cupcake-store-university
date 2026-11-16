import Link from "next/link";

export function LoadingCards() {
  return (
    <div
      aria-label="Carregando cupcakes"
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
    >
      {[1, 2, 3].map((item) => (
        <div key={item} className="card overflow-hidden">
          <div className="skeleton h-52" />
          <div className="space-y-3 p-5">
            <div className="skeleton h-5 w-2/3 rounded" />
            <div className="skeleton h-4 w-full rounded" />
            <div className="skeleton h-10 w-1/2 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  href,
  action,
}: {
  title: string;
  description: string;
  href?: string;
  action?: string;
}) {
  return (
    <div
      className="card mx-auto max-w-2xl p-8 text-center sm:p-12"
      role="status"
    >
      <div aria-hidden="true" className="mb-4 text-4xl">
        ✿
      </div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-3 text-muted">{description}</p>
      {href && action && (
        <Link href={href} className="btn-primary mt-6">
          {action}
        </Link>
      )}
    </div>
  );
}

export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="card mx-auto max-w-2xl p-8 text-center" role="alert">
      <h2 className="text-2xl font-bold">Algo deu errado</h2>
      <p className="mt-3 text-muted">{message}</p>
      {retry && (
        <button type="button" onClick={retry} className="btn-secondary mt-6">
          Tentar novamente
        </button>
      )}
    </div>
  );
}
