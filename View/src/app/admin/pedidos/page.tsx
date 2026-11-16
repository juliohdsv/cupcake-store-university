"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { EmptyState, ErrorState } from "../../../components/Feedback";
import { useAdminAuth } from "../../../context/AdminAuthContext";
import { ApiError, advanceOrder, deleteAdminOrder, fetchAdminOrders } from "../../../lib/api";
import {
  brl,
  fulfillmentLabels,
  paymentLabels,
  paymentMethodLabels,
} from "../../../lib/format";
import type { Order } from "../../../lib/schemas";

const nextStatus = {
  RECEIVED: "PREPARING",
  PREPARING: "OUT_FOR_DELIVERY",
  OUT_FOR_DELIVERY: "DELIVERED",
} as const;
const statusFilters = [
  { value: "ALL", label: "Todos" },
  { value: "AWAITING_PAYMENT", label: "Aguardando pagamento" },
  { value: "RECEIVED", label: "Recebido" },
  { value: "PREPARING", label: "Em preparo" },
  { value: "OUT_FOR_DELIVERY", label: "Saiu para entrega" },
  { value: "DELIVERED", label: "Entregue" },
] as const;
type StatusFilter = (typeof statusFilters)[number]["value"];

export default function AdminOrdersPage() {
  const router = useRouter();
  const { status, role, logout: endSession, markExpired } = useAdminAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [retry, setRetry] = useState(0);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  useEffect(() => {
    if (status === "unauthenticated") router.replace("/admin");
  }, [status, router]);
  useEffect(() => {
    if (status !== "authenticated") return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetchAdminOrders(controller.signal)
      .then(setOrders)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        if (reason instanceof ApiError && reason.code === "UNAUTHORIZED") {
          markExpired();
          return;
        }
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar pedidos.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry, status, markExpired]);

  async function advance(order: Order) {
    const target =
      nextStatus[order.fulfillmentStatus as keyof typeof nextStatus];
    if (!target) return;
    setBusyId(order.id);
    try {
      const updated = await advanceOrder(order.id, target);
      setOrders((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      toast.success(
        `Pedido atualizado: ${fulfillmentLabels[updated.fulfillmentStatus]}.`,
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "UNAUTHORIZED") {
        markExpired();
        return;
      }
      toast.error(
        reason instanceof Error
          ? reason.message
          : "Falha ao atualizar o pedido.",
      );
    } finally {
      setBusyId("");
    }
  }
  async function logout() {
    try {
      await endSession();
      router.push("/admin");
    } catch {
      toast.error("Não foi possível encerrar a sessão.");
    }
  }
  async function removeOrder(order: Order) {
    if (!window.confirm(`Apagar definitivamente o pedido #${order.id.slice(0, 8)} de ${order.customerName}? O acompanhamento também deixará de funcionar.`)) return;
    setDeletingId(order.id);
    try {
      await deleteAdminOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      toast.success("Pedido apagado.");
    } catch (reason) {
      if (reason instanceof ApiError && reason.code === "UNAUTHORIZED") { markExpired(); return; }
      toast.error(reason instanceof Error ? reason.message : "Não foi possível apagar o pedido.");
    } finally { setDeletingId(""); }
  }
  const visibleOrders =
    statusFilter === "ALL"
      ? orders
      : orders.filter((order) => order.fulfillmentStatus === statusFilter);
  const selectedLabel =
    statusFilters.find((option) => option.value === statusFilter)?.label ??
    "status selecionado";
  const availableFilters = role === "OWNER" ? statusFilters : statusFilters.filter((option) => option.value !== "AWAITING_PAYMENT");

  return (
    <main className="container-page min-h-[60vh] py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-berry">
            Área da loja
          </p>
          <h1 className="section-title mt-2 font-bold">{role === "OWNER" ? "Todos os pedidos" : "Pedidos pagos"}</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/avaliacoes" className="btn-secondary">
            Ver avaliações
          </Link>
          <button
            type="button"
            onClick={() => void logout()}
            className="btn-secondary"
          >
            Sair
          </button>
        </div>
      </div>
      {status !== "authenticated" || loading ? (
        <div className="skeleton mt-8 h-72 rounded-2xl" />
      ) : error ? (
        <div className="mt-8">
          <ErrorState
            message={error}
            retry={() => setRetry((value) => value + 1)}
          />
          <p className="mt-4 text-center text-sm">
            <Link href="/admin" className="text-berry underline">
              Voltar ao login
            </Link>
          </p>
        </div>
      ) : orders.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title={role === "OWNER" ? "Nenhum pedido ainda" : "Nenhum pedido pago ainda"}
            description={role === "OWNER" ? "Os pedidos criados aparecerão aqui." : "Os pedidos aprovados aparecerão aqui para acompanhar a entrega."}
          />
        </div>
      ) : (
        <>
          <div
            className="mt-8 flex flex-wrap gap-2"
            role="group"
            aria-label="Filtrar pedidos por status"
          >
            {availableFilters.map(({ value, label }) => {
              const selected = statusFilter === value;
              const count =
                value === "ALL"
                  ? orders.length
                  : orders.filter((order) => order.fulfillmentStatus === value)
                      .length;
              return (
                <button
                  key={value}
                  type="button"
                  aria-label={`Filtrar pedidos: ${label}`}
                  aria-pressed={selected}
                  onClick={() => setStatusFilter(value)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold transition-colors ${selected ? "bg-berry text-white" : "border border-sand bg-white text-cocoa hover:bg-blush"}`}
                >
                  {label}
                  <span
                    aria-hidden="true"
                    className={`rounded-full px-2 py-0.5 text-xs ${selected ? "bg-white/20 text-white" : "bg-blush text-berry"}`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
          <div aria-live="polite">
            {visibleOrders.length === 0 ? (
              <div className="card mt-5 p-8 text-center" role="status">
                <h2 className="text-2xl font-bold">
                  Nenhum pedido em {selectedLabel.toLowerCase()}
                </h2>
                <p className="mt-3 text-muted">
                  Escolha outro status para continuar acompanhando os pedidos.
                </p>
                <button
                  type="button"
                  onClick={() => setStatusFilter("ALL")}
                  className="btn-secondary mt-5"
                >
                  Ver todos
                </button>
              </div>
            ) : (
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {visibleOrders.map((order) => {
                  const target =
                    nextStatus[
                      order.fulfillmentStatus as keyof typeof nextStatus
                    ];
                  return (
                    <article key={order.id} className="card p-6">
                      <div className="flex flex-wrap justify-between gap-3">
                        <h2 className="text-xl font-bold">
                          Pedido #{order.id.slice(0, 8)}
                        </h2>
                        <span className="rounded-full bg-blush px-3 py-1 text-sm font-semibold text-berry">
                          {fulfillmentLabels[order.fulfillmentStatus]}
                        </span>
                      </div>
                      <p className="mt-3 text-sm text-muted">
                        {order.customerName} · {order.delivery.city}/
                        {order.delivery.state}
                      </p>
                      {role === "OWNER" && <p className="mt-2 text-sm text-muted">{paymentLabels[order.paymentStatus]}</p>}
                      <p className="mt-4 text-sm">
                        {order.items
                          .map(
                            (item) => `${item.quantity}× ${item.productName}`,
                          )
                          .join(" · ")}
                      </p>
                      <p className="mt-3 font-bold">{brl(order.totalCents)}</p>
                      {order.paymentAttempts.length > 0 && (
                        <p className="mt-2 text-sm text-muted">
                          Pagamento:{" "}
                          {
                            paymentMethodLabels[
                              order.paymentAttempts.at(-1)!.method
                            ]
                          }
                        </p>
                      )}
                      <div className="mt-5 flex flex-wrap gap-3">
                        {target && (
                          <button
                            type="button"
                            disabled={busyId === order.id || deletingId === order.id}
                            onClick={() => void advance(order)}
                            className="btn-primary text-sm"
                          >
                            {busyId === order.id
                              ? "Atualizando..."
                              : `Avançar para ${fulfillmentLabels[target]}`}
                          </button>
                        )}
                        <Link
                          href={`/pedido/${order.publicToken}`}
                          className="btn-secondary text-sm"
                        >
                          Ver acompanhamento
                        </Link>
                        {role === "OWNER" && <button type="button" onClick={() => void removeOrder(order)}
                          disabled={busyId === order.id || deletingId === order.id}
                          className="btn-secondary border-red-300 text-sm text-red-700 hover:bg-red-50">
                          {deletingId === order.id ? "Apagando..." : "Apagar pedido"}
                        </button>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </main>
  );
}
