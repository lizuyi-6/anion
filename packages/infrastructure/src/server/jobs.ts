import { tasks } from "@trigger.dev/sdk/v3";

import { runtimeEnv } from "@anion/config";
import type { JobQueue } from "@anion/application";
import { toId } from "@anion/shared/utils";

export function createJobQueue(): JobQueue | undefined {
  if (runtimeEnv.queueDriver !== "trigger") {
    return undefined;
  }

  return {
    async enqueueInterviewAnalysis(sessionId: string) {
      const handle = (await tasks.trigger("analyze-interview-session", {
        sessionId,
      })) as { id?: string };

      return {
        id: handle.id ?? toId("analysis_job"),
      };
    },
  };
}
