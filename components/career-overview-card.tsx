import type { CareerSummary } from "@/lib/domain";

interface CareerOverviewCardProps {
  summary: CareerSummary;
}

function formatDaysSince(days: number | null): string {
  if (days === null) return "暂无记录";
  if (days === 0) return "今天";
  if (days === 1) return "昨天";
  if (days < 7) return `${days} 天前`;
  if (days < 30) return `${Math.floor(days / 7)} 周前`;
  return `${Math.floor(days / 30)} 个月前`;
}

function getStreakEmoji(streak: number): string {
  if (streak >= 7) return "🔥";
  if (streak >= 3) return "⚡";
  return "";
}

export function CareerOverviewCard({ summary }: CareerOverviewCardProps) {
  const { totalSessions, daysSinceLastSession, streakDays, milestones } = summary;

  const recentMilestones = milestones.slice(0, 3);
  const showStreak = streakDays >= 3;

  return (
    <article className="workspace-card career-overview-card">
      <div className="career-stats-row">
        <div className="career-stat">
          <span className="career-stat-value">{totalSessions}</span>
          <span className="career-stat-label">累计分析</span>
        </div>
        <div className="career-stat">
          <span className="career-stat-value">
            {formatDaysSince(daysSinceLastSession)}
          </span>
          <span className="career-stat-label">上次活动</span>
        </div>
        {showStreak && (
          <div className="career-stat streak">
            <span className="career-stat-value">
              {getStreakEmoji(streakDays)}
              {streakDays}
            </span>
            <span className="career-stat-label">天连续</span>
          </div>
        )}
      </div>

      {recentMilestones.length > 0 && (
        <div className="milestone-row">
          {recentMilestones.map((milestone) => (
            <div key={milestone.id + milestone.kind} className="milestone-chip">
              <span className="milestone-icon">✓</span>
              <span className="milestone-title">{milestone.title}</span>
            </div>
          ))}
        </div>
      )}

      <p className="career-suggestion">{summary.nextSuggestedAction}</p>

      <style>{`
        .career-overview-card {
          padding: 1.5rem;
        }
        .career-stats-row {
          display: flex;
          gap: 2rem;
          margin-bottom: 1rem;
        }
        .career-stat {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }
        .career-stat-value {
          font-size: 1.75rem;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.2;
        }
        .career-stat-label {
          font-size: 0.875rem;
          color: var(--text-secondary);
        }
        .career-stat.streak .career-stat-value {
          color: var(--accent-primary);
        }
        .milestone-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .milestone-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          background: var(--bg-subtle);
          border-radius: 9999px;
          font-size: 0.8125rem;
        }
        .milestone-icon {
          color: var(--success);
        }
        .milestone-title {
          color: var(--text-secondary);
        }
        .career-suggestion {
          font-size: 0.9375rem;
          color: var(--text-secondary);
          margin: 0;
          padding-top: 0.75rem;
          border-top: 1px solid var(--border-subtle);
        }
      `}</style>
    </article>
  );
}
