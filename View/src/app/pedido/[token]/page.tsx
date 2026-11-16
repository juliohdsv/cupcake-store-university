"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ErrorState } from "../../../components/Feedback";
import { fetchOrder } from "../../../lib/api";
import {
  brl,
  fulfillmentLabels,
  paymentLabels,
  paymentMethodLabels,
} from "../../../lib/format";
import type { Order } from "../../../lib/schemas";

const steps = [
  "RECEIVED",
  "PREPARING",
  "OUT_FOR_DELIVERY",
  "DELIVERED",
] as const;

export default function TrackingPage() {
  const { token } = useParams<{ token: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchOrder(token, controller.signal)
      .then(setOrder)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setError(
          reason instanceof Error ? reason.message : "Pedido não encontrado.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [token, retry]);

  return (
    <main className="container-page min-h-[60vh] py-12">
      <Link
        href="/"
        className="text-sm font-semibold text-berry hover:underline"
      >
        ← Voltar à vitrine
      </Link>
      <h1 className="section-title mt-5 font-bold">Acompanhar pedido</h1>
      {loading ? (
        <div className="skeleton mt-8 h-96 rounded-2xl" />
      ) : error ? (
        <div className="mt-8">
          <ErrorState
            message={error}
            retry={() => setRetry((value) => value + 1)}
          />
        </div>
      ) : (
        order && (
          <div
            className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]"
            aria-live="polite"
          >
            <section className="card p-6 sm:p-8">
              <p className="text-sm text-muted">
                Pedido{" "}
                <span className="font-mono">#{order.id.slice(0, 8)}</span>
              </p>
              <h2 className="mt-3 text-2xl font-bold">
                Olá, {order.customerName}
              </h2>
              <p className="mt-3 text-muted">
                {paymentLabels[order.paymentStatus]}
              </p>
              {order.paymentAttempts.length > 0 && (
                <p className="mt-2 text-sm text-muted">
                  Forma de pagamento:{" "}
                  {paymentMethodLabels[order.paymentAttempts.at(-1)!.method]}
                </p>
              )}
              {order.paymentStatus !== "APPROVED" ? (
                <p className="mt-5 rounded-lg bg-blush p-4 text-berry">
                  Seu pedido aguarda pagamento simulado. Se a tentativa foi
                  recusada, volte à etapa de checkout na mesma sessão para
                  testar outro cartão.
                </p>
              ) : (
                <>
                  <h3 className="mt-8 text-xl font-bold">
                    Andamento da entrega
                  </h3>
                  <ol className="mt-5 space-y-4">
                    {steps.map((step, index) => {
                      const currentIndex = steps.indexOf(
                        order.fulfillmentStatus as (typeof steps)[number],
                      );
                      const completed = index <= currentIndex;
                      return (
                        <li key={step} className="flex items-center gap-3">
                          <span
                            aria-hidden="true"
                            className={`grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold ${completed ? "bg-leaf text-white" : "bg-sand text-muted"}`}
                          >
                            {completed ? "✓" : index + 1}
                          </span>
                          <span
                            className={
                              completed ? "font-semibold" : "text-muted"
                            }
                          >
                            {fulfillmentLabels[step]}
                          </span>
                          {index === currentIndex && (
                            <span className="text-xs text-leaf">Atual</span>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </>
              )}
              <p className="mt-8 border-t border-sand pt-5 text-sm text-muted">
                Entrega: {order.delivery.street}, {order.delivery.number},{" "}
                {order.delivery.neighborhood}, {order.delivery.city}/
                {order.delivery.state}
              </p>
            </section>
            <aside className="card p-6">
              <h2 className="text-2xl font-bold">Seu pedido</h2>
              <ul className="mt-5 space-y-3 text-sm">
                {order.items.map((item) => (
                  <li key={item.id} className="flex justify-between gap-2">
                    <span>
                      {item.quantity}× {item.productName}
                    </span>
                    <strong>{brl(item.lineTotalCents)}</strong>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-3 border-t border-sand pt-4 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <strong>{brl(order.subtotalCents)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Entrega</span>
                  <strong>{brl(order.shippingCents)}</strong>
                </div>
                <div className="flex justify-between border-t border-sand pt-3 text-lg font-bold">
                  <span>Total</span>
                  <span>{brl(order.totalCents)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setRetry((value) => value + 1)}
                className="btn-secondary mt-6 w-full"
              >
                Atualizar andamento
              </button>
            </aside>
          </div>
        )
      )}
    </main>
  );
}
