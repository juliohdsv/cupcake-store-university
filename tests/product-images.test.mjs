import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import model from "@pit/model";

test("todos os cupcakes do catálogo possuem foto JPEG local", () => {
  const db = model.openDatabase(":memory:");
  try {
    model.migrate(db);
    model.seedProducts(db);
    const products = model.listProducts(db);
    assert.equal(products.length, 10);
    for (const product of products) {
      assert.equal(product.imagePath, `/products/${product.slug}.jpg`);
      const path = resolve("View/public", `.${product.imagePath}`);
      const bytes = readFileSync(path);
      assert.deepEqual([...bytes.subarray(0, 3)], [0xff, 0xd8, 0xff]);
      assert.ok(statSync(path).size < 500_000, `${product.name}: foto maior que 500 KB`);
    }
  } finally { db.close(); }
});
