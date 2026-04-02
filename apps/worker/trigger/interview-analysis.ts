import { task } from "@trigger.dev/sdk/v3";

import { executeInterviewAnalysis } from "@anion/application";
import { getAiProvider, getDataStore } from "@anion/infrastructure";

export const analyzeInterviewTask = task({
  id: "analyze-interview-session",
  run: async (payload: { sessionId: string }) => {
    const store = await getDataStore({ admin: true });
    return executeInterviewAnalysis({
      sessionId: payload.sessionId,
      store,
      ai: getAiProvider(),
    });
  },
});
