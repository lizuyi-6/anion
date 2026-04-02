import { runtimeEnv } from "@anion/config";

console.log(
  `[worker] queueDriver=${runtimeEnv.queueDriver} workerPort=${runtimeEnv.workerPort} triggerProject=${runtimeEnv.triggerProjectId ?? "unset"}`,
);

setInterval(() => {
  console.log("[worker] heartbeat");
}, 60_000);
