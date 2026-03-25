import { task } from "@trigger.dev/sdk/v3";

import { getDataStore } from "@/lib/server/store/repository";
import { executeInterviewAnalysis } from "@/lib/server/services/analysis";

export const analyzeInterviewTask = task({
  id: "analyze-interview-session",
  run: async (payload: { sessionId: string }) => {
    const store = await getDataStore({ admin: true });
    return executeInterviewAnalysis({
      sessionId: payload.sessionId,
      store,
    });
  },
});
