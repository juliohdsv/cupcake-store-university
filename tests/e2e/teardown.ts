import { existsSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";

export default function teardown() {
  const path = resolve("Model/data/e2e.sqlite");
  for (const suffix of ["", "-wal", "-shm"]) if (existsSync(path + suffix)) unlinkSync(path + suffix);
}
