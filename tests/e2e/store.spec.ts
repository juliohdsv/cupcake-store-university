import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";

async function fillDelivery(page: import("@playwright/test").Page, name = "Cliente E2E") {
  await page.getByLabel("Nome completo").fill(name);
  await page.getByLabel("E-mail").fill("cliente@example.test");
  await page.getByLabel("Telefone com DDD").fill("11999999999");
  await page.getByLabel("CEP").fill("01310100");
  await page.getByLabel("Rua / avenida").fill("Avenida Exemplo");
  await page.getByLabel("Número", { exact: true }).fill("123");
  await page.getByLabel("Bairro").fill("Centro");
  await page.getByLabel("Cidade").fill("São Paulo");
  await page.getByLabel("UF").fill("SP");
}

async function goToCheckout(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Adicionar Chocolate Belga ao carrinho" }).click();
  await page.getByRole("button", { name: "Adicionar Red Velvet ao carrinho" }).click();
  await page.getByRole("link", { name: /Carrinho/ }).click();
  await expect(page.getByRole("heading", { name: "Seu carrinho" })).toBeVisible();
  await page.getByRole("link", { name: "Continuar para entrega" }).click();
  await expect(page.getByRole("heading", { name: "Finalizar pedido" })).toBeVisible();
}

test("duas recusas, aprovação, acompanhamento e entrega administrativa", async ({ page }) => {
  await goToCheckout(page);
  await fillDelivery(page);
  await page.getByRole("button", { name: "Confirmar pedido e valor" }).click();
  await expect(page.getByRole("heading", { name: "Escolha uma forma de pagamento" })).toBeVisible();
  await page.getByRole("button", { name: "Cartão de crédito" }).click();
  await expect(page.getByRole("heading", { name: "Escolha um cartão de demonstração" })).toBeVisible();
  await expect(page.getByText("R$ 36,70")).toBeVisible();
  await page.getByRole("button", { name: /Recusar por limite/ }).click();
  await expect(page.locator("main").getByRole("alert").filter({ hasText: "limite insuficiente" })).toBeVisible();
  await expect(page.getByLabel("Número do cartão de teste")).toHaveValue("4000 0000 0000 9995");
  await expect(page.getByLabel("Validade de teste")).toHaveValue("12/30");
  await expect(page.getByLabel("CVV de teste")).toHaveValue("123");
  await page.getByRole("button", { name: /Outra recusa/ }).click();
  await expect(page.locator("main").getByRole("alert").filter({ hasText: "cartão não autorizado" })).toBeVisible();
  await page.getByRole("button", { name: /Aprovar/ }).click();
  await expect(page).toHaveURL(/\/pedido\//);
  await expect(page.getByText("Pagamento aprovado")).toBeVisible();
  await expect(page.locator("main").getByText("Pedido recebido", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Painel admin" }).hover();
  await expect(page.getByRole("tooltip", { name: "Senha de demonstração: 12345678" })).toBeVisible();
  await page.getByRole("link", { name: "Painel admin" }).click();
  await page.getByLabel("Senha administrativa").fill("12345678");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/pedidos/);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Pedidos pagos" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Ver avaliações" })).toBeVisible();
  await page.setViewportSize({ width: 320, height: 700 });
  await expect(page.getByRole("group", { name: "Filtrar pedidos por status" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expect(page.locator(".Toastify__toast")).toHaveCount(0, { timeout: 10_000 });
  await page.screenshot({ path: "docs/evidencias/admin-filtros-mobile-320.png" });
  const card = page.locator("article").filter({ hasText: "Cliente E2E" });
  await expect(card).toBeVisible();
  await expect(card.getByRole("button", { name: "Apagar pedido" })).toHaveCount(0);
  await page.getByRole("button", { name: "Filtrar pedidos: Entregue" }).click();
  await expect(page.getByRole("heading", { name: "Nenhum pedido em entregue" })).toBeVisible();
  await page.getByRole("button", { name: "Ver todos" }).click();
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Avançar para Em preparo" }).click();
  await card.getByRole("button", { name: "Avançar para Saiu para entrega" }).click();
  await card.getByRole("button", { name: "Avançar para Entregue" }).click();
  await expect(card.getByText("Entregue")).toBeVisible();
  await page.getByRole("button", { name: "Filtrar pedidos: Em preparo" }).click();
  await expect(card).not.toBeVisible();
  await page.getByRole("button", { name: "Filtrar pedidos: Entregue" }).click();
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: "Ver acompanhamento" }).click();
  await expect(page.locator("main").getByText("Entregue", { exact: true })).toBeVisible();
});

test("Pix e boleto simulados registram o método e mostram o status", async ({ page }) => {
  for (const [method, action, label] of [
    ["Pix", "Simular pagamento Pix", "Pix"],
    ["Boleto", "Simular confirmação do boleto", "Boleto"],
  ]) {
    await goToCheckout(page);
    await fillDelivery(page, `Cliente ${method}`);
    await page.getByRole("button", { name: "Confirmar pedido e valor" }).click();
    await page.getByRole("button", { name: method, exact: true }).click();
    await page.getByRole("button", { name: action }).click();
    await expect(page).toHaveURL(/\/pedido\//);
    await expect(page.getByText("Pagamento aprovado")).toBeVisible();
    await expect(page.getByText(`Forma de pagamento: ${label}`)).toBeVisible();
  }
});

test("formulário inválido não envia pedido", async ({ page }) => {
  await goToCheckout(page);
  let posts = 0;
  page.on("request", (request) => { if (request.method() === "POST" && request.url().endsWith("/orders")) posts += 1; });
  await page.getByRole("button", { name: "Confirmar pedido e valor" }).click();
  await expect(page.getByText("Informe seu nome.")).toBeVisible();
  await expect(page.getByText("Informe um CEP com 8 dígitos.")).toBeVisible();
  expect(posts).toBe(0);
});

test("avaliação pelo modal é enviada e o formulário valida campos obrigatórios", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(page.locator("#avaliacoes").getByText("Sem avaliações.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Avaliar o site" }).click();
  const dialog = page.getByRole("dialog", { name: "Avalie a Doce & Afeto" });
  await expect(dialog).toBeVisible();
  await page.screenshot({ path: "docs/evidencias/avaliacao-mobile-320.png" });
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Avaliar o site" })).toBeFocused();
  await page.getByRole("button", { name: "Avaliar o site" }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await dialog.getByRole("button", { name: "Enviar feedback" }).click();
  await expect(dialog.getByText("Informe seu nome.")).toBeVisible();
  await expect(dialog.getByText("Selecione uma nota.")).toBeVisible();
  await dialog.getByLabel("Seu nome *").fill("Avaliadora E2E");
  await dialog.getByLabel("O que você testou e funcionou").fill("A vitrine abriu corretamente.");
  await dialog.getByRole("button", { name: "4 estrelas" }).click();
  await dialog.getByRole("checkbox", { name: /Autorizo a exibição pública/ }).check();
  await dialog.getByLabel("Captura de tela (opcional)", { exact: true }).setInputFiles({
    name: "captura.png", mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64"),
  });
  await expect(dialog.getByText("Imagem selecionada: captura.png")).toBeVisible();
  await dialog.getByRole("button", { name: "Enviar feedback" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("Obrigado! Sua avaliação foi enviada.")).toBeVisible();
  await expect(page.locator("#avaliacoes").getByText("Sem avaliações.", { exact: true })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Ver avaliação completa de Avaliadora E2E" })).toBeVisible();
  await page.getByRole("link", { name: "Ver avaliação completa de Avaliadora E2E" }).click();
  await expect(page).toHaveURL(/\/avaliacoes\/[0-9a-f-]+/);
  await expect(page.getByText("A vitrine abriu corretamente.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sugestões de melhoria" })).toBeVisible();
  await expect(page.getByRole("img", { name: "Captura de tela enviada por Avaliadora E2E" })).toBeVisible();
  await expect(page.locator("main input, main textarea")).toHaveCount(0);
  await page.goto("/admin");
  await expect(page.getByLabel("Usuário")).toHaveValue("convidado");
  await page.getByLabel("Senha administrativa").fill("12345678");
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("link", { name: "Ver avaliações" }).click();
  await expect(page.getByRole("heading", { name: "Avaliações recebidas" })).toBeVisible();
  await page.getByRole("link", { name: "Ver avaliação completa de Avaliadora E2E" }).click();
  await expect(page.getByText("A vitrine abriu corretamente.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Apagar avaliação" })).toHaveCount(0);
  await expect(page.locator("main input, main textarea")).toHaveCount(0);
});

test("acesso oficial apaga avaliação e o footer permanece no fim", async ({ page, request }) => {
  const created = await request.post("/api/v1/site-reviews", { data: {
    reviewerName: "Avaliação removível E2E", testDate: "2026-11-16", worked: "Teste de exclusão",
    failed: "", notTested: "", suggestions: "", rating: 5, publicationConsent: true,
  } });
  expect(created.status()).toBe(201);
  await page.goto("/admin");
  await page.getByLabel("Usuário").fill("engenheiro");
  await page.getByLabel("Senha administrativa").fill("senha-oficial-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/pedidos/);
  await page.getByRole("link", { name: "Ver avaliações" }).click();
  await page.getByRole("link", { name: "Ver avaliação completa de Avaliação removível E2E" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Apagar avaliação" }).click();
  await expect(page).toHaveURL(/\/admin\/avaliacoes$/);
  await expect(page.getByRole("link", { name: "Ver avaliação completa de Avaliação removível E2E" })).toHaveCount(0);
  for (const path of ["/admin", "/carrinho", "/avaliacoes", "/produtos/red-velvet"]) {
    await page.goto(path);
    const footerBottom = await page.locator("footer").evaluate((footer) => footer.getBoundingClientRect().bottom);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    expect(footerBottom, `Footer antes do fim em ${path}`).toBeGreaterThanOrEqual(viewportHeight - 1);
  }
});

test("acesso oficial apaga pedido pendente e invalida o acompanhamento", async ({ page, request }) => {
  const created = await request.post("/api/v1/orders", { data: {
    items: [{ productId: "chocolate-belga", quantity: 1 }],
    customer: { name: "Pedido removível E2E", email: "pedido@example.test", phone: "11999999999" },
    delivery: { zipCode: "01310100", street: "Rua Exemplo", number: "10", complement: "",
      neighborhood: "Centro", city: "São Paulo", state: "SP" },
  } });
  expect(created.status()).toBe(201);
  const order = (await created.json()).order as { id: string; publicToken: string };
  await page.goto("/admin");
  await page.getByLabel("Usuário").fill("engenheiro");
  await page.getByLabel("Senha administrativa").fill("senha-oficial-e2e");
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).toHaveURL(/\/admin\/pedidos/);
  await expect(page.getByRole("heading", { name: "Todos os pedidos" })).toBeVisible();
  const card = page.locator("article").filter({ hasText: "Pedido removível E2E" });
  await expect(card).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await card.getByRole("button", { name: "Apagar pedido" }).click();
  await expect(card).toHaveCount(0);
  expect((await request.get(`/api/v1/orders/track/${order.publicToken}`)).status()).toBe(404);
});

test("fluxo completo em 320px sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Pequenos doces/ })).toBeVisible();
  mkdirSync("docs/evidencias", { recursive: true });
  await page.screenshot({ path: "docs/evidencias/vitrine-mobile-320.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Adicionar Chocolate Belga ao carrinho" }).click();
  await page.getByRole("link", { name: /Carrinho/ }).click();
  await page.getByRole("link", { name: "Continuar para entrega" }).click();
  await fillDelivery(page, "Cliente Mobile");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Confirmar pedido e valor" }).click();
  await page.getByRole("button", { name: "Cartão de crédito" }).click();
  await expect(page.getByRole("button", { name: "Cartão de crédito" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".Toastify__toast")).toHaveCount(0, { timeout: 10_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "docs/evidencias/pagamento-mobile-320.png", fullPage: true });
  await page.getByRole("button", { name: /Aprovar/ }).click();
  await expect(page).toHaveURL(/\/pedido\//);
  await expect(page.getByText("Pagamento aprovado")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.waitForTimeout(4500);
  await page.screenshot({ path: "docs/evidencias/pedido-mobile-320.png", fullPage: true });
});
