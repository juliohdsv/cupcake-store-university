import { openDatabase } from "./connection";
import { migrate } from "./migrate";
import { seedProducts } from "./seed";

const db = openDatabase();
try {
  migrate(db);
  if (process.argv[2] === "seed") seedProducts(db);
  console.log(process.argv[2] === "seed" ? "Banco migrado e catálogo populado." : "Migrações aplicadas.");
} finally {
  db.close();
}
