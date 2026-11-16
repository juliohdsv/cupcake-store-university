import { existsSync, mkdirSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
const path = resolve("Model/data/e2e.sqlite");
mkdirSync(dirname(path), { recursive: true });
for (const suffix of ["", "-wal", "-shm"]) if (existsSync(path + suffix)) unlinkSync(path + suffix);
