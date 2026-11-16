import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import model from "@pit/model";

const script = resolve("deployment/prepare-local.mjs");

test("preparo local cria senha demo, chave de sessão e banco uma vez, preservando os dados", () => {
  const folder = mkdtempSync(join(tmpdir(), "pit-local-"));
  const databasePath = join(folder, "cupcakes.sqlite");
  const envPath = join(folder, ".env");
  const run = () => spawnSync(process.execPath, ["--env-file-if-exists=.env", script], {
    cwd: folder,
    env: { ...process.env, DATABASE_PATH: databasePath },
    encoding: "utf8",
  });

  try {
    const first = run();
    assert.equal(first.status, 0, first.stderr);
    const originalEnv = readFileSync(envPath, "utf8");
    assert.match(originalEnv, /^ADMIN_PASSWORD=12345678$/m);
    assert.match(originalEnv, /^NEXT_PUBLIC_DEMO_ADMIN_PASSWORD=12345678$/m);
    assert.match(originalEnv, /^ADMIN_SESSION_KEY=[A-Za-z0-9_-]{43}$/m);
    assert.equal(statSync(envPath).mode & 0o777, 0o600);

    const db = model.openDatabase(databasePath);
    try {
      assert.equal(model.listProducts(db).length, 10);
      db.prepare("UPDATE products SET price_cents = ? WHERE id = ?").run(1725, "chocolate-belga");
    } finally { db.close(); }

    const second = run();
    assert.equal(second.status, 0, second.stderr);
    assert.equal(readFileSync(envPath, "utf8"), originalEnv);
    const reopened = model.openDatabase(databasePath);
    try {
      assert.equal(model.getProductBySlug(reopened, "chocolate-belga")?.priceCents, 1725);
    } finally { reopened.close(); }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
