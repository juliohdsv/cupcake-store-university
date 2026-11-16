"use client";

import { useEffect, useRef, useState } from "react";
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ClipboardEvent,
} from "react";
import { toast } from "react-toastify";
import { submitSiteReview } from "../lib/api";
import { siteReviewSchema } from "../lib/schemas";
import type { SiteReviewForm } from "../lib/schemas";

type TextField = "worked" | "failed" | "notTested" | "suggestions";
const textFields: Array<{
  key: TextField;
  label: string;
  placeholder?: string;
}> = [
  {
    key: "worked",
    label: "O que você testou e funcionou",
    placeholder:
      "Ex.: adicionei cupcakes ao carrinho e concluí o pedido com um cartão de teste.",
  },
  {
    key: "failed",
    label: "O que testou e não funcionou (e o que deve ser corrigido)",
    placeholder: "Ex.: no celular, o botão ficou atrás do teclado.",
  },
  {
    key: "notTested",
    label: "O que não testou (e por quê)",
    placeholder: "Ex.: não testei o acompanhamento do pedido.",
  },
  { key: "suggestions", label: "Sugestões de melhoria" },
];
const emptyForm: SiteReviewForm = {
  reviewerName: "",
  testDate: "",
  worked: "",
  failed: "",
  notTested: "",
  suggestions: "",
  rating: 0,
  publicationConsent: false,
};
const imageTypes = ["image/png", "image/jpeg", "image/webp"];

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function SiteReview() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<SiteReviewForm>(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [screenshot, setScreenshot] = useState<{
    mimeType: string;
    dataBase64: string;
    name: string;
  } | null>(null);
  const [fileError, setFileError] = useState("");
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [open]);

  useEffect(() => () => requestRef.current?.abort(), []);

  function show() {
    setForm((current) => ({
      ...current,
      testDate: current.testDate || localDate(),
    }));
    setOpen(true);
  }

  function close() {
    if (sending) requestRef.current?.abort();
    dialogRef.current?.close();
    setOpen(false);
    setSending(false);
    triggerRef.current?.focus();
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape" && sending) requestRef.current?.abort();
  }

  function loadImage(file: File) {
    setFileError("");
    if (
      !imageTypes.includes(file.type) ||
      file.size === 0 ||
      file.size > 3 * 1024 * 1024
    ) {
      setFileError("Escolha uma imagem PNG, JPEG ou WebP de até 3 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      const dataBase64 = value.split(",")[1];
      if (!dataBase64) {
        setFileError("Não foi possível ler a imagem.");
        return;
      }
      setScreenshot({
        mimeType: file.type,
        dataBase64,
        name: file.name || "Captura colada",
      });
    };
    reader.onerror = () => setFileError("Não foi possível ler a imagem.");
    reader.readAsDataURL(file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) loadImage(file);
    event.target.value = "";
  }

  function handlePaste(event: ClipboardEvent<HTMLDialogElement>) {
    const file = Array.from(event.clipboardData.items)
      .find((item) => item.kind === "file" && item.type.startsWith("image/"))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      loadImage(file);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitError("");
    const parsed = siteReviewSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            String(issue.path[0]),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setErrors({});
    if (fileError) return;
    const controller = new AbortController();
    requestRef.current = controller;
    setSending(true);
    try {
      await submitSiteReview(
        parsed.data,
        screenshot
          ? { mimeType: screenshot.mimeType, dataBase64: screenshot.dataBase64 }
          : undefined,
        controller.signal,
      );
      setForm(emptyForm);
      setScreenshot(null);
      close();
      window.dispatchEvent(new Event("site-review-sent"));
      toast.success("Obrigado! Sua avaliação foi enviada.");
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Não foi possível enviar a avaliação.",
        );
      }
    } finally {
      requestRef.current = null;
      setSending(false);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={show}
        className="btn-primary fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-40 gap-2 shadow-lg shadow-cocoa/20"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-5 shrink-0"
        >
          <path d="m12 2 3.1 6.28 6.93 1.01-5.01 4.88 1.18 6.9L12 17.82l-6.2 3.25 1.18-6.9-5.01-4.88 6.93-1.01L12 2Z" />
        </svg>
        Avaliar o site
      </button>
      <dialog
        ref={dialogRef}
        onClose={() => {
          setOpen(false);
          triggerRef.current?.focus();
        }}
        onKeyDown={handleDialogKeyDown}
        onPaste={handlePaste}
        aria-labelledby="site-review-title"
        aria-describedby="site-review-description"
        className="site-review-dialog w-[min(42rem,calc(100%-2rem))] max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl border border-sand bg-white p-0 text-cocoa shadow-2xl"
      >
        <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <h2
              id="site-review-title"
              className="text-2xl font-bold sm:text-3xl"
            >
              Avalie a Doce & Afeto
            </h2>
            <button
              type="button"
              onClick={close}
              aria-label="Fechar avaliação"
              className="min-h-11 min-w-11 rounded-lg text-2xl text-muted hover:bg-blush"
            >
              ×
            </button>
          </div>
          <p id="site-review-description" className="mt-3 text-muted">
            Você está testando um projeto da faculdade. Nada é cobrado; use os
            cartões de teste no checkout. Conte o que funcionou e o que deu
            errado, sem dó.
          </p>

          <div className="mt-6 space-y-5">
            <div>
              <label
                htmlFor="reviewer-name"
                className="mb-2 block font-semibold"
              >
                Seu nome *
              </label>
              <input
                id="reviewer-name"
                className="input"
                value={form.reviewerName}
                maxLength={100}
                onChange={(event) =>
                  setForm({ ...form, reviewerName: event.target.value })
                }
                aria-invalid={!!errors.reviewerName}
                aria-describedby={
                  errors.reviewerName ? "reviewer-name-error" : undefined
                }
                autoComplete="name"
              />
              {errors.reviewerName && (
                <p id="reviewer-name-error" className="field-error">
                  {errors.reviewerName}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="review-test-date"
                className="mb-2 block font-semibold"
              >
                Data do teste *
              </label>
              <input
                id="review-test-date"
                type="date"
                className="input"
                value={form.testDate}
                onChange={(event) =>
                  setForm({ ...form, testDate: event.target.value })
                }
                aria-invalid={!!errors.testDate}
                aria-describedby={
                  errors.testDate ? "review-test-date-error" : undefined
                }
              />
              {errors.testDate && (
                <p id="review-test-date-error" className="field-error">
                  {errors.testDate}
                </p>
              )}
            </div>
            {textFields.map(({ key, label, placeholder }) => (
              <div key={key}>
                <label
                  htmlFor={`review-${key}`}
                  className="mb-2 block font-semibold"
                >
                  {label}
                </label>
                <textarea
                  id={`review-${key}`}
                  className="input min-h-28 resize-y"
                  value={form[key]}
                  maxLength={2000}
                  placeholder={placeholder}
                  onChange={(event) =>
                    setForm({ ...form, [key]: event.target.value })
                  }
                  aria-invalid={!!errors[key]}
                  aria-describedby={
                    errors[key] ? `review-${key}-error` : undefined
                  }
                />
                {errors[key] && (
                  <p id={`review-${key}-error`} className="field-error">
                    {errors[key]}
                  </p>
                )}
              </div>
            ))}
            <fieldset>
              <legend className="mb-2 font-semibold">Nota geral *</legend>
              <div
                className="flex gap-1"
                role="group"
                aria-label="Nota geral de 1 a 5 estrelas"
              >
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    aria-label={`${rating} ${rating === 1 ? "estrela" : "estrelas"}`}
                    aria-pressed={form.rating === rating}
                    onClick={() => setForm({ ...form, rating })}
                    className={`min-h-11 min-w-11 text-4xl leading-none ${rating <= form.rating ? "text-berry" : "text-[#b8a29a]"}`}
                  >
                    {rating <= form.rating ? "★" : "☆"}
                  </button>
                ))}
              </div>
              {errors.rating && <p className="field-error">{errors.rating}</p>}
            </fieldset>
            <div>
              <label
                htmlFor="review-screenshot"
                className="mb-2 block font-semibold"
              >
                Captura de tela (opcional)
              </label>
              <label
                htmlFor="review-screenshot"
                className="flex min-h-20 cursor-pointer items-center rounded-xl border-2 border-dashed border-sand px-4 py-3 text-muted hover:bg-cream"
              >
                {screenshot
                  ? `Imagem selecionada: ${screenshot.name}`
                  : "Escolha uma imagem (PNG, JPEG ou WebP, até 3 MB) ou cole com Ctrl+V."}
              </label>
              <input
                id="review-screenshot"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                className="sr-only"
              />
              {screenshot && (
                <button
                  type="button"
                  onClick={() => {
                    setScreenshot(null);
                    setFileError("");
                  }}
                  className="mt-2 text-sm font-semibold text-berry underline"
                >
                  Remover imagem
                </button>
              )}
              {fileError && (
                <p className="field-error" role="alert">
                  {fileError}
                </p>
              )}
            </div>
            <label className="flex items-start gap-3 text-sm text-muted">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 accent-berry"
                checked={form.publicationConsent}
                onChange={(event) =>
                  setForm({ ...form, publicationConsent: event.target.checked })
                }
              />
              Autorizo a exibição pública do meu nome, comentários, nota e
              captura de tela nesta loja. Sem autorização, somente o
              administrador poderá ver minha avaliação.
            </label>
          </div>
          {submitError && (
            <p
              className="mt-5 rounded-lg bg-blush p-3 text-sm text-cocoa"
              role="alert"
            >
              {submitError}
            </p>
          )}
          <div className="mt-7 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={close} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={sending} className="btn-primary">
              {sending ? "Enviando..." : "Enviar feedback"}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
