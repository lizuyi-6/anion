import { spawn } from "node:child_process";

const [workspace, script] = process.argv.slice(2);

if (!workspace || !script) {
  console.error("Usage: node scripts/run-workspace.mjs <workspace> <script>");
  process.exit(1);
}

const portBase = Number(process.env.PORT_BASE ?? "3000");
if (!Number.isInteger(portBase) || portBase <= 0) {
  console.error(`Invalid PORT_BASE: ${process.env.PORT_BASE ?? ""}`);
  process.exit(1);
}

const derived = {
  PORT_BASE: String(portBase),
  WEB_PORT: String(portBase),
  API_PORT: String(portBase + 1),
  WORKER_PORT: String(portBase + 2),
  PUBLIC_ORIGIN: process.env.PUBLIC_ORIGIN ?? `http://127.0.0.1:${portBase}`,
};

const workspaceName = `@anion/${workspace}`;
const env = {
  ...process.env,
  ...derived,
  PORT:
    workspace === "web"
      ? derived.WEB_PORT
      : workspace === "api"
        ? derived.API_PORT
        : derived.WORKER_PORT,
  PLAYWRIGHT_BASE_URL:
    process.env.PLAYWRIGHT_BASE_URL ?? `${derived.PUBLIC_ORIGIN}`,
};

const child = spawn("pnpm", ["--filter", workspaceName, "run", script], {
  stdio: "inherit",
  shell: true,
  env,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
