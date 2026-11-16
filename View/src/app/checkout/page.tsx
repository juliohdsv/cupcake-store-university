"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "react-toastify";
import { EmptyState, ErrorState } from "../../components/Feedback";
import { useCart } from "../../context/CartContext";
import { ApiError, createOrder, fetchProducts, payOrder } from "../../lib/api";
import { brl } from "../../lib/format";
import { checkoutSchema } from "../../lib/schemas";
import type {
  CheckoutForm,
  Order,
  PaymentMethod,
  Product,
} from "../../lib/schemas";

const initialForm: CheckoutForm = {
  name: "",
  email: "",
  phone: "",
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  neighborhood: "",
  city: "",
  state: "",
};
const fields: Array<{
  key: keyof CheckoutForm;
  label: string;
  autoComplete?: string;
  placeholder?: string;
}> = [
  { key: "name", label: "Nome completo", autoComplete: "name" },
  { key: "email", label: "E-mail", autoComplete: "email" },
  {
    key: "phone",
    label: "Telefone com DDD",
    autoComplete: "tel",
    placeholder: "11999999999",
  },
  {
    key: "zipCode",
    label: "CEP",
    autoComplete: "postal-code",
    placeholder: "01310100",
  },
  { key: "street", label: "Rua / avenida", autoComplete: "street-address" },
  { key: "number", label: "Número" },
  { key: "complement", label: "Complemento (opcional)" },
  { key: "neighborhood", label: "Bairro" },
  { key: "city", label: "Cidade", autoComplete: "address-level2" },
  {
    key: "state",
    label: "UF",
    autoComplete: "address-level1",
    placeholder: "SP",
  },
];
const cards = [
  {
    number: "4242424242424242",
    label: "Aprovar",
    hint: "Pagamento simulado aprovado",
    last4: "4242",
  },
  {
    number: "4000000000009995",
    label: "Recusar por limite",
    hint: "Limite insuficiente",
    last4: "9995",
  },
  {
    number: "4000000000000002",
    label: "Outra recusa",
    hint: "Cartão não autorizado",
    last4: "0002",
  },
] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, ready, clear } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [form, setForm] = useState<CheckoutForm>(initialForm);
  const [errors, setErrors] = useState<
    Partial<Record<keyof CheckoutForm, string>>
  >({});
  const [order, setOrder] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [selectedCardNumber, setSelectedCardNumber] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetchProducts({}, controller.signal)
      .then(setProducts)
      .catch((reason: unknown) => {
        if (reason instanceof Error && reason.name === "AbortError") return;
        setLoadError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar o resumo.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [retry]);

  const lookup = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const estimate = items.reduce(
    (sum, item) =>
      sum + (lookup.get(item.productId)?.priceCents ?? 0) * item.quantity,
    0,
  );
  const unavailable = items.some((item) => !lookup.has(item.productId));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = checkoutSchema.safeParse(form);
    if (!parsed.success) {
      const nextErrors: Partial<Record<keyof CheckoutForm, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CheckoutForm;
        if (!nextErrors[key]) nextErrors[key] = issue.message;
      }
      setErrors(nextErrors);
      document.getElementById(String(parsed.error.issues[0]?.path[0]))?.focus();
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const created = await createOrder(items, parsed.data);
      setOrder(created);
      toast.success(
        "Pedido criado. Escolha uma forma de pagamento de demonstração.",
      );
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Não foi possível criar o pedido.";
      if (reason instanceof ApiError) {
        const nextErrors: Partial<Record<keyof CheckoutForm, string>> = {};
        for (const detail of reason.details) {
          const key = detail.field.split(".").at(-1) as keyof CheckoutForm;
          if (key in form) nextErrors[key] = detail.message;
        }
        setErrors(nextErrors);
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function processPayment(method: PaymentMethod, number?: string) {
    if (!order) return;
    if (number) setSelectedCardNumber(number);
    setBusy(true);
    setPaymentMessage("");
    try {
      const result = await payOrder(
        order.id,
        order.publicToken,
        method,
        number,
      );
      setOrder(result.order);
      if (result.payment.outcome === "APPROVED") {
        clear();
        toast.success(
          `${method === "PIX" ? "Pix" : method === "BOLETO" ? "Boleto" : "Cartão"} simulado aprovado. Pedido recebido!`,
        );
        router.push(`/pedido/${result.order.publicToken}`);
      } else {
        const message =
          result.payment.outcome === "INSUFFICIENT_FUNDS"
            ? "Pagamento simulado recusado: limite insuficiente. Escolha outro cartão de teste."
            : "Pagamento simulado recusado: cartão não autorizado. Escolha outro cartão de teste.";
        setPaymentMessage(message);
        toast.info(message);
      }
    } catch (reason) {
      const message =
        reason instanceof Error
          ? reason.message
          : "Falha ao tentar pagamento simulado.";
      setPaymentMessage(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="container-page min-h-[60vh] py-12">
      <p className="text-sm font-bold uppercase tracking-widest text-berry">
        Sua encomenda
      </p>
      <h1 className="section-title mt-2 font-bold">Finalizar pedido</h1>
      <div
        className="mt-6 rounded-xl border border-berry/25 bg-blush p-4 font-semibold text-cocoa"
        role="note"
      >
        Ambiente acadêmico de simulação. Nenhum valor será cobrado. Não informe
        dados reais de cartão.
      </div>
      {!ready || loading ? (
        <div className="skeleton mt-8 h-80 rounded-2xl" />
      ) : loadError ? (
        <div className="mt-8">
          <ErrorState
            message={loadError}
            retry={() => {
              setLoadError("");
              setLoading(true);
              setRetry((value) => value + 1);
            }}
          />
        </div>
      ) : items.length === 0 && !order ? (
        <div className="mt-8">
          <EmptyState
            title="Seu carrinho está vazio"
            description="Escolha cupcakes antes de continuar."
            href="/"
            action="Ver cupcakes"
          />
        </div>
      ) : (
        <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {order ? (
              <section className="card p-6 sm:p-8" aria-live="polite">
                <p className="text-sm font-bold uppercase tracking-widest text-berry">
                  Pedido criado
                </p>
                <h2 className="mt-2 text-2xl font-bold">
                  Escolha uma forma de pagamento
                </h2>
                <p className="mt-3 text-muted">
                  Pix, cartão e boleto são apenas simulações. Nenhum valor será
                  cobrado.
                </p>
                <div
                  className="mt-6 grid gap-3 sm:grid-cols-3"
                  role="group"
                  aria-label="Formas de pagamento simuladas"
                >
                  {(
                    [
                      ["PIX", "Pix"],
                      ["CREDIT_CARD", "Cartão de crédito"],
                      ["BOLETO", "Boleto"],
                    ] as const
                  ).map(([method, label]) => (
                    <button
                      key={method}
                      type="button"
                      disabled={busy}
                      aria-pressed={paymentMethod === method}
                      onClick={() => {
                        setPaymentMethod(method);
                        setPaymentMessage("");
                        setSelectedCardNumber("");
                      }}
                      className={`min-h-16 rounded-xl border p-4 text-left font-bold transition-colors ${paymentMethod === method ? "border-berry bg-blush text-berry" : "border-sand bg-cream hover:border-berry hover:bg-blush"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {paymentMethod === "CREDIT_CARD" && (
                  <div className="mt-6">
                    <h3 className="text-xl font-bold">
                      Escolha um cartão de demonstração
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      Toque em um cenário para preencher os dados fictícios e
                      ver o resultado. Após uma recusa, você pode tentar outro
                      sem criar novo pedido.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3">
                      {cards.map((card) => (
                        <button
                          key={card.number}
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            void processPayment("CREDIT_CARD", card.number)
                          }
                          className="min-h-28 rounded-xl border border-sand bg-cream p-4 text-left transition-colors hover:border-berry hover:bg-blush"
                        >
                          <span className="block font-bold text-berry">
                            {card.label}
                          </span>
                          <span className="mt-2 block text-sm text-muted">
                            {card.hint}
                          </span>
                          <span className="mt-2 block text-xs text-muted">
                            Cartão demo •••• {card.last4}
                          </span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <label className="text-sm font-semibold sm:col-span-3">
                        Número do cartão de teste
                        <input
                          className="input mt-2"
                          value={selectedCardNumber
                            .replace(/(.{4})/g, "$1 ")
                            .trim()}
                          readOnly
                          placeholder="Selecione um cenário acima"
                        />
                      </label>
                      <label className="text-sm font-semibold">
                        Validade de teste
                        <input
                          className="input mt-2"
                          value={selectedCardNumber ? "12/30" : ""}
                          readOnly
                        />
                      </label>
                      <label className="text-sm font-semibold">
                        CVV de teste
                        <input
                          className="input mt-2"
                          value={selectedCardNumber ? "123" : ""}
                          readOnly
                        />
                      </label>
                    </div>
                  </div>
                )}
                {paymentMethod === "PIX" && (
                  <div className="mt-6 rounded-xl border border-sand bg-cream p-5">
                    <h3 className="text-xl font-bold">Pix de demonstração</h3>
                    <p className="mt-2 text-sm text-muted">
                      A confirmação é fictícia. Não há chave, QR Code ou
                      transferência real.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void processPayment("PIX")}
                      className="btn-primary mt-4"
                    >
                      Simular pagamento Pix
                    </button>
                  </div>
                )}
                {paymentMethod === "BOLETO" && (
                  <div className="mt-6 rounded-xl border border-sand bg-cream p-5">
                    <h3 className="text-xl font-bold">
                      Boleto de demonstração
                    </h3>
                    <p className="mt-2 text-sm text-muted">
                      A confirmação é fictícia. Não há linha digitável, emissão
                      ou pagamento real.
                    </p>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void processPayment("BOLETO")}
                      className="btn-primary mt-4"
                    >
                      Simular confirmação do boleto
                    </button>
                  </div>
                )}
                {busy && (
                  <p className="mt-4 text-sm" role="status">
                    Registrando tentativa simulada...
                  </p>
                )}
                {paymentMessage && (
                  <p
                    className="mt-5 rounded-lg bg-blush p-4 font-semibold text-berry"
                    role="alert"
                  >
                    {paymentMessage}
                  </p>
                )}
                <p className="mt-6 text-sm text-muted">
                  Entrega: {order.delivery.street}, {order.delivery.number},{" "}
                  {order.delivery.city}/{order.delivery.state}
                </p>
              </section>
            ) : (
              <form
                onSubmit={(event) => void submit(event)}
                noValidate
                className="card p-6 sm:p-8"
              >
                <h2 className="text-2xl font-bold">Dados de entrega</h2>
                <p className="mt-2 text-sm text-muted">
                  Entrega fictícia em endereço informado para a demonstração.
                </p>
                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  {fields.map(({ key, label, autoComplete, placeholder }) => (
                    <label
                      key={key}
                      htmlFor={key}
                      className={`block text-sm font-semibold ${key === "street" ? "sm:col-span-2" : ""}`}
                    >
                      {label}
                      <input
                        id={key}
                        className="input mt-2"
                        value={form[key]}
                        placeholder={placeholder}
                        autoComplete={autoComplete}
                        type={
                          key === "email"
                            ? "email"
                            : key === "phone"
                              ? "tel"
                              : "text"
                        }
                        aria-invalid={!!errors[key]}
                        aria-describedby={
                          errors[key] ? `${key}-error` : undefined
                        }
                        onChange={(event) =>
                          setForm((current) => ({
                            ...current,
                            [key]:
                              key === "state"
                                ? event.target.value.toUpperCase()
                                : event.target.value,
                          }))
                        }
                      />
                      {errors[key] && (
                        <span
                          id={`${key}-error`}
                          className="field-error block"
                          role="alert"
                        >
                          {errors[key]}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <button
                  type="submit"
                  className="btn-primary mt-8 w-full sm:w-auto"
                  disabled={busy || unavailable}
                >
                  {busy ? "Criando pedido..." : "Confirmar pedido e valor"}
                </button>
                {unavailable && (
                  <p className="mt-3 text-sm text-berry" role="alert">
                    Há itens indisponíveis. Volte ao carrinho para removê-los.
                  </p>
                )}
              </form>
            )}
          </div>
          <aside className="card p-6">
            <h2 className="text-2xl font-bold">Resumo do pedido</h2>
            <ul className="mt-5 space-y-3 text-sm">
              {order
                ? order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>
                        {item.quantity}× {item.productName}
                      </span>
                      <strong>{brl(item.lineTotalCents)}</strong>
                    </li>
                  ))
                : items.map((item) => (
                    <li
                      key={item.productId}
                      className="flex justify-between gap-2"
                    >
                      <span>
                        {item.quantity}×{" "}
                        {lookup.get(item.productId)?.name ?? "Indisponível"}
                      </span>
                      <strong>
                        {brl(
                          (lookup.get(item.productId)?.priceCents ?? 0) *
                            item.quantity,
                        )}
                      </strong>
                    </li>
                  ))}
            </ul>
            <div className="mt-5 border-t border-sand pt-4 text-sm">
              <div className="flex justify-between">
                <span>Subtotal {order ? "confirmado" : "estimado"}</span>
                <strong>{brl(order?.subtotalCents ?? estimate)}</strong>
              </div>
              {order ? (
                <>
                  <div className="mt-3 flex justify-between">
                    <span>Entrega</span>
                    <strong>{brl(order.shippingCents)}</strong>
                  </div>
                  <div className="mt-4 flex justify-between border-t border-sand pt-4 text-lg font-bold">
                    <span>Total</span>
                    <span>{brl(order.totalCents)}</span>
                  </div>
                </>
              ) : (
                <p className="mt-3 text-muted">
                  Taxa de entrega fictícia fixa de R$ 8,90. Total confirmado
                  pelo servidor após criar o pedido.
                </p>
              )}
            </div>
            {!order && (
              <Link
                href="/carrinho"
                className="mt-5 block text-sm font-semibold text-berry hover:underline"
              >
                ← Editar carrinho
              </Link>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
