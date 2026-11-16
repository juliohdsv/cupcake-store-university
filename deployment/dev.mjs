import { spawn } from "node:child_process";
import { resolve } from "node:path";

const detached = process.platform !== "win32";
const commands = [
  ["API", ["--env-file-if-exists=.env", "--import", "tsx", "Controller/src/server.ts"], {
    API_PORT: "3021", API_HOST: "127.0.0.1", WEB_ORIGIN: "http://127.0.0.1:3020",
  }],
  ["View", [resolve("node_modules/next/dist/bin/next"), "dev", "View", "--hostname", "127.0.0.1", "--port", "3020"], {
    API_INTERNAL_ORIGIN: "http://127.0.0.1:3021",
  }],
];

const children = commands.map(([name, args, environment]) => ({
  name,
  process: spawn(process.execPath, args, { stdio: "inherit", detached, env: { ...process.env, ...environment } }),
}));
let stopping = false;
let exited = 0;

function signalChild(child, signal) {
  if (!child.pid) return;
  try { process.kill(detached ? -child.pid : child.pid, signal); }
  catch (error) { if (error.code !== "ESRCH") console.error("Falha ao encerrar processo local.", error); }
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) signalChild(child.process, "SIGTERM");
  setTimeout(() => {
    for (const child of children) signalChild(child.process, "SIGKILL");
  }, 3000).unref();
}

for (const child of children) {
  child.process.on("error", (error) => {
    console.error(`Falha ao iniciar ${child.name}.`, error);
    stop(1);
  });
  child.process.on("exit", (code, signal) => {
    exited += 1;
    if (!stopping) {
      console.error(`${child.name} encerrou (${signal ?? code}).`);
      stop(code || 1);
    }
    if (exited === children.length) process.exitCode ??= 0;
  });
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(signal, () => stop());
process.on("exit", () => {
  for (const child of children) signalChild(child.process, "SIGTERM");
});
