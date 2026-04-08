import type { Viewer } from "@/lib/domain";
import type { CareerSummary } from "@/lib/domain";
import type { OpenClawCronJob } from "./types";
import type { OpenClawClient } from "./client";

const CRON_PREFIX = "mobius";

function cronId(viewerId: string, name: string): string {
  return `${CRON_PREFIX}:${viewerId}:${name}`;
}

export async function registerUserCronJobs(params: {
  client: OpenClawClient;
  viewer: Viewer;
  careerSummary: CareerSummary;
}): Promise<void> {
  const { client, viewer, careerSummary } = params;
  const jobs: OpenClawCronJob[] = [];

  if (careerSummary.daysSinceLastSession !== null && careerSummary.daysSinceLastSession > 3) {
    jobs.push({
      id: cronId(viewer.id, "daily-checkin"),
      name: "daily-checkin",
      schedule: { type: "cron", expression: "0 9 * * 1-5", timezone: "Asia/Shanghai" },
      style: "isolated",
      delivery: "webhook",
      payload: { userId: viewer.id, type: "reminder", message: `距离上次活动已 ${careerSummary.daysSinceLastSession} 天` },
      enabled: true,
    });
  }

  jobs.push({
    id: cronId(viewer.id, "weekly-skill-review"),
    name: "weekly-skill-review",
    schedule: { type: "cron", expression: "0 9 * * 1", timezone: "Asia/Shanghai" },
    style: "isolated",
    delivery: "webhook",
    payload: { userId: viewer.id, type: "weekly_summary" },
    enabled: true,
  });

  if (careerSummary.recurringGaps.length >= 2) {
    jobs.push({
      id: cronId(viewer.id, "gap-alert"),
      name: "gap-alert",
      schedule: { type: "interval", every: "72h" },
      style: "isolated",
      delivery: "webhook",
      payload: { userId: viewer.id, type: "suggestion", gaps: careerSummary.recurringGaps.slice(0, 3).map(g => g.label) },
      enabled: true,
    });
  }

  for (const job of jobs) {
    await client.send("cron.create", { job });
  }
}

export async function unregisterUserCronJobs(
  client: OpenClawClient,
  viewerId: string,
): Promise<void> {
  const names = ["daily-checkin", "weekly-skill-review", "gap-alert", "milestone-check"];
  for (const name of names) {
    await client.send("cron.delete", { id: cronId(viewerId, name) });
  }
}
