const portBase = Number(process.env.PORT_BASE ?? "3000");

if (!Number.isInteger(portBase) || portBase <= 0) {
  console.error(`PORT_BASE must be a positive integer, got: ${process.env.PORT_BASE ?? ""}`);
  process.exit(1);
}

const derived = {
  web: portBase,
  api: portBase + 1,
  worker: portBase + 2,
};

process.stdout.write(`${JSON.stringify(derived, null, 2)}\n`);
