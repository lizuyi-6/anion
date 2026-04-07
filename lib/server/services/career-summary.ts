import type {
  CareerSummary,
  MemoryNode,
  Milestone,
  SkillTrend,
} from "@/lib/domain";
import { toId } from "@/lib/utils";
import type { DataStore } from "@/lib/server/store/repository";

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}

function calculateTrend(
  history: Array<{ confidence: number; recordedAt: string }>
): "improving" | "declining" | "stable" {
  if (history.length < 2) return "stable";

  const sorted = [...history].sort((a, b) =>
    a.recordedAt.localeCompare(b.recordedAt)
  );
  const recent = sorted.slice(-3);
  const older = sorted.slice(0, -3);

  if (older.length === 0) return "stable";

  const recentAvg =
    recent.reduce((sum, h) => sum + h.confidence, 0) / recent.length;
  const olderAvg =
    older.reduce((sum, h) => sum + h.confidence, 0) / older.length;

  const diff = recentAvg - olderAvg;
  if (diff > 0.05) return "improving";
  if (diff < -0.05) return "declining";
  return "stable";
}

function findRecurringGaps(
  profiles: Array<{
    gaps: MemoryNode[];
    generatedAt: string;
    sessionId: string;
  }>
): MemoryNode[] {
  // Group gaps by similar labels
  const gapCounts = new Map<string, { node: MemoryNode; count: number }>();

  for (const profile of profiles) {
    for (const gap of profile.gaps) {
      const key = gap.label.toLowerCase().trim();
      const existing = gapCounts.get(key);
      if (existing) {
        existing.count++;
        // Keep the one with higher confidence
        if (gap.confidence > existing.node.confidence) {
          existing.node = gap;
        }
      } else {
        gapCounts.set(key, { node: gap, count: 1 });
      }
    }
  }

  // Return gaps that appear in multiple sessions
  const recurring: MemoryNode[] = [];
  for (const { node, count } of gapCounts.values()) {
    if (count >= 2) {
      recurring.push(node);
    }
  }

  // Sort by confidence descending
  return recurring.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function aggregateSkills(
  profiles: Array<{
    skills: MemoryNode[];
    generatedAt: string;
    sessionId: string;
  }>
): SkillTrend[] {
  // Group skills by label and track confidence over time
  const skillHistory = new Map<
    string,
    Array<{ confidence: number; recordedAt: string; sessionId: string }>
  >();

  for (const profile of profiles) {
    for (const skill of profile.skills) {
      const key = skill.label.toLowerCase().trim();
      const history = skillHistory.get(key) ?? [];
      history.push({
        confidence: skill.confidence,
        recordedAt: profile.generatedAt,
        sessionId: profile.sessionId,
      });
      skillHistory.set(key, history);
    }
  }

  // Convert to SkillTrend array
  const trends: SkillTrend[] = [];
  for (const [label, history] of skillHistory) {
    const sortedHistory = [...history].sort((a, b) =>
      a.recordedAt.localeCompare(b.recordedAt)
    );
    trends.push({
      label,
      confidenceHistory: sortedHistory,
      trend: calculateTrend(history),
    });
  }

  return trends.sort((a, b) => {
    // Sort by most recent confidence, descending
    const aLatest = a.confidenceHistory[a.confidenceHistory.length - 1]?.confidence ?? 0;
    const bLatest = b.confidenceHistory[b.confidenceHistory.length - 1]?.confidence ?? 0;
    return bLatest - aLatest;
  });
}

function aggregateTopWins(
  profiles: Array<{ wins: MemoryNode[] }>
): MemoryNode[] {
  const allWins: MemoryNode[] = [];
  for (const profile of profiles) {
    allWins.push(...profile.wins);
  }
  return allWins.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
}

function detectMilestones(
  totalSessions: number,
  skillsTrend: SkillTrend[],
  streakDays: number
): Milestone[] {
  const milestones: Milestone[] = [];

  if (totalSessions >= 1) {
    milestones.push({
      id: toId("milestone"),
      kind: "first_session",
      title: "完成首场模拟",
      description: "你已完成第一场面试模拟，迈出了第一步。",
      achievedAt: new Date().toISOString(),
    });
  }

  if (totalSessions >= 3) {
    milestones.push({
      id: toId("milestone"),
      kind: "sessions_3",
      title: "三场训练达成",
      description: "已完成 3 场面试模拟，保持这个节奏。",
      achievedAt: new Date().toISOString(),
    });
  }

  if (totalSessions >= 5) {
    milestones.push({
      id: toId("milestone"),
      kind: "sessions_5",
      title: "五场训练达成",
      description: "已完成 5 场面试模拟，你在持续积累经验。",
      achievedAt: new Date().toISOString(),
    });
  }

  if (totalSessions >= 10) {
    milestones.push({
      id: toId("milestone"),
      kind: "sessions_10",
      title: "十场训练达成",
      description: "已完成 10 场面试模拟，你是一个认真的准备者。",
      achievedAt: new Date().toISOString(),
    });
  }

  // Check for skill improvements
  for (const trend of skillsTrend) {
    if (trend.trend === "improving" && trend.confidenceHistory.length >= 2) {
      const first = trend.confidenceHistory[0].confidence;
      const last = trend.confidenceHistory[trend.confidenceHistory.length - 1].confidence;
      if (last - first >= 0.1) {
        milestones.push({
          id: toId("milestone"),
          kind: "skill_improved_10",
          title: `${trend.label} 提升显著`,
          description: `你的「${trend.label}」能力有明显提升。`,
          achievedAt: new Date().toISOString(),
        });
        break; // Only show one skill improvement milestone
      }
    }
  }

  if (streakDays >= 7) {
    milestones.push({
      id: toId("milestone"),
      kind: "streak_7_days",
      title: "连续 7 天活跃",
      description: "你已连续 7 天进行训练，保持这个好习惯。",
      achievedAt: new Date().toISOString(),
    });
  }

  return milestones;
}

function calculateStreak(
  sessions: Array<{ updatedAt: string }>
): number {
  if (sessions.length === 0) return 0;

  // Sort sessions by date descending
  const sortedDates = sessions
    .map((s) => s.updatedAt.slice(0, 10)) // Get date part only
    .sort((a, b) => b.localeCompare(a));

  // Remove duplicates
  const uniqueDates = [...new Set(sortedDates)];

  // Count consecutive days from today
  const today = new Date().toISOString().slice(0, 10);
  let streak = 0;
  let checkDate = new Date(today);

  for (const date of uniqueDates) {
    const checkDateStr = checkDate.toISOString().slice(0, 10);
    if (date === checkDateStr) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else if (date === new Date(checkDate.getTime() - 86400000).toISOString().slice(0, 10)) {
      // Allow for yesterday if today hasn't been done yet
      streak++;
      checkDate = new Date(date);
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export async function getCareerSummary(
  userId: string,
  store: DataStore
): Promise<CareerSummary> {
  // Get all sessions for the user
  const sessions = await store.listSessions(userId);

  // Get all memory profiles
  const memoryProfiles = await store.listMemoryProfiles(userId);

  // Calculate basic stats
  const totalSessions = sessions.length;

  // Sort profiles by generation date
  const sortedProfiles = [...memoryProfiles].sort((a, b) =>
    a.generatedAt.localeCompare(b.generatedAt)
  );

  // Aggregate skills with history
  const skillsTrend = aggregateSkills(
    sortedProfiles.map((p) => ({
      skills: p.skills,
      generatedAt: p.generatedAt,
      sessionId: p.sessionId,
    }))
  );

  // Find recurring gaps
  const recurringGaps = findRecurringGaps(
    sortedProfiles.map((p) => ({
      gaps: p.gaps,
      generatedAt: p.generatedAt,
      sessionId: p.sessionId,
    }))
  );

  // Aggregate top wins
  const topWins = aggregateTopWins(sortedProfiles);

  // Calculate last active
  const lastSession = sessions[0]; // Already sorted by updatedAt desc
  const lastActiveAt = lastSession?.updatedAt ?? null;
  const daysSinceLastSession = lastActiveAt
    ? daysBetween(lastActiveAt, new Date().toISOString())
    : null;

  // Calculate streak
  const streakDays = calculateStreak(sessions);

  // Detect milestones
  const milestones = detectMilestones(totalSessions, skillsTrend, streakDays);

  // Generate next suggested action
  let nextSuggestedAction = "继续模拟训练，保持手感。";
  if (daysSinceLastSession !== null && daysSinceLastSession > 7) {
    nextSuggestedAction = "距离上次训练已超过一周，建议尽快恢复练习。";
  } else if (recurringGaps.length > 0) {
    nextSuggestedAction = `重点提升「${recurringGaps[0].label}」，这是多次训练中反复出现的短板。`;
  } else if (totalSessions === 0) {
    nextSuggestedAction = "开始你的第一场模拟训练。";
  } else if (totalSessions >= 5) {
    nextSuggestedAction = "你已经积累了足够经验，可以考虑真实的面试机会。";
  }

  return {
    totalSessions,
    skillsTrend,
    recurringGaps,
    topWins,
    lastActiveAt,
    nextSuggestedAction,
    milestones,
    daysSinceLastSession,
    streakDays,
  };
}
