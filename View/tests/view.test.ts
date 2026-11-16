import { describe, expect, it } from "vitest";
import { brl } from "../src/lib/format";
import {
  checkoutSchema,
  productSchema,
  siteReviewSchema,
} from "../src/lib/schemas";

const valid = {
  name: "Cliente Teste",
  email: "cliente@example.test",
  phone: "11999999999",
  zipCode: "01310100",
  street: "Avenida Exemplo",
  number: "123",
  complement: "",
  neighborhood: "Centro",
  city: "São Paulo",
  state: "SP",
};

describe("View", () => {
  it("formata centavos em BRL sem alterar o valor recebido", () => {
    expect(brl(4960).replace(/\s/g, " ")).toBe("R$ 49,60");
    expect(brl(890).replace(/\s/g, " ")).toBe("R$ 8,90");
  });

  it("valida os dados de entrega antes de criar o pedido", () => {
    expect(checkoutSchema.safeParse(valid).success).toBe(true);
    const invalid = checkoutSchema.safeParse({
      ...valid,
      email: "invalido",
      phone: "123",
      zipCode: "123",
      state: "S",
    });
    expect(invalid.success).toBe(false);
    if (!invalid.success)
      expect(invalid.error.issues.map((issue) => issue.path[0])).toEqual(
        expect.arrayContaining(["email", "phone", "zipCode", "state"]),
      );
  });

  it("rejeita produto sem preço inteiro no contrato visual", () => {
    expect(
      productSchema.safeParse({
        id: "x",
        slug: "x",
        name: "x",
        description: "x",
        category: "x",
        imagePath: "/x.svg",
        priceCents: 12.5,
        active: true,
      }).success,
    ).toBe(false);
  });

  it("exige nome, data e nota da avaliação", () => {
    const validReview = {
      reviewerName: "Pessoa Avaliadora",
      testDate: "2026-11-16",
      worked: "",
      failed: "",
      notTested: "",
      suggestions: "",
      rating: 5,
      publicationConsent: false,
    };
    expect(siteReviewSchema.safeParse(validReview).success).toBe(true);
    expect(
      siteReviewSchema.safeParse({
        ...validReview,
        reviewerName: "",
        rating: 0,
      }).success,
    ).toBe(false);
  });
});
