import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Header } from "../components/Header";
import { Providers } from "../components/Providers";
import { SiteReview } from "../components/SiteReview";
import "./globals.css";

export const metadata: Metadata = {
  title: "Doce & Afeto | Cupcakes",
  description: "Cupcakes para celebrar cada momento. Projeto acadêmico PIT II.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="flex min-h-dvh flex-col">
        <Providers>
          <Header />
          {children}
          <footer className="mt-auto border-t border-sand py-8 text-center text-sm text-muted">
            <div className="container-page">
              Doce & Afeto · Projeto Integrador Transdiciplinar em Engenharia de
              Software II · Pagamentos exclusivamente simulados
            </div>
          </footer>
          <SiteReview />
        </Providers>
      </body>
    </html>
  );
}
