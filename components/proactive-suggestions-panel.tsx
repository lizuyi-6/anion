import type { CareerSummary, MemoryNode } from "@/lib/domain";
import Link from "next/link";

interface ProactiveSuggestionsPanelProps {
  summary: CareerSummary;
  topGap?: MemoryNode;
}

function getSuggestions(
  summary: CareerSummary,
  topGap?: MemoryNode
): Array<{ type: "info" | "warning" | "action"; message: string; href?: string; label?: string }> {
  const suggestions: Array<{
    type: "info" | "warning" | "action";
    message: string;
    href?: string;
    label?: string;
  }> = [];

  // Warning for long inactivity
  if (summary.daysSinceLastSession !== null && summary.daysSinceLastSession > 7) {
    suggestions.push({
      type: "warning",
      message: `距离上次分析已 ${summary.daysSinceLastSession} 天，手感可能会下降`,
      href: "/simulator/new",
      label: "继续分析",
    });
  }

  // Info for recurring gaps
  if (summary.recurringGaps.length > 0) {
    const gap = summary.recurringGaps[0];
    suggestions.push({
      type: "info",
      message: `「${gap.label}」在多轮分析中反复出现，建议重点突破`,
      href: "/hub/copilot",
      label: "针对性提升",
    });
  }

  // Action for skill improvement
  const improvingSkills = summary.skillsTrend.filter(
    (s) => s.trend === "improving"
  );
  if (improvingSkills.length > 0) {
    suggestions.push({
      type: "action",
      message: `「${improvingSkills[0].label}」正在稳步提升，继续保持`,
    });
  }

  // Encouragement for new users
  if (summary.totalSessions === 0) {
    suggestions.push({
      type: "action",
      message: "开始第一场模拟演练，建立你的能力基线",
      href: "/simulator/new",
      label: "开始分析",
    });
  }

  // Suggestion for experienced users
  if (summary.totalSessions >= 5 && summary.streakDays < 3) {
    suggestions.push({
      type: "info",
      message: "你已经积累了足够经验，建议保持每周至少 2 次的分析频率",
    });
  }

  // Top gap suggestion
  if (topGap && summary.totalSessions >= 2) {
    suggestions.push({
      type: "action",
      message: `当前最需提升：${topGap.label}`,
      href: "/hub/strategy",
      label: "制定计划",
    });
  }

  return suggestions.slice(0, 3);
}

export function ProactiveSuggestionsPanel({
  summary,
  topGap,
}: ProactiveSuggestionsPanelProps) {
  const suggestions = getSuggestions(summary, topGap);

  if (suggestions.length === 0) {
    return null;
  }

  return (
    <div className="proactive-suggestions-panel">
      <p className="panel-label">智能建议</p>
      <div className="suggestions-list">
        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`suggestion-item suggestion-${suggestion.type}`}
          >
            <p className="suggestion-message">{suggestion.message}</p>
            {suggestion.href && suggestion.label && (
              <Link href={suggestion.href} className="suggestion-link">
                {suggestion.label} →
              </Link>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .proactive-suggestions-panel {
          padding: 1rem;
          background: var(--bg-subtle);
          border-radius: var(--radius-lg);
          margin-top: 1rem;
        }
        .suggestions-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 0.75rem;
        }
        .suggestion-item {
          padding: 0.75rem 1rem;
          background: var(--bg-primary);
          border-radius: var(--radius-md);
          border-left: 3px solid var(--border-default);
        }
        .suggestion-info {
          border-left-color: var(--accent-primary);
        }
        .suggestion-warning {
          border-left-color: var(--warning);
        }
        .suggestion-action {
          border-left-color: var(--success);
        }
        .suggestion-message {
          font-size: 0.875rem;
          color: var(--text-primary);
          margin: 0;
        }
        .suggestion-link {
          display: inline-block;
          margin-top: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--accent-primary);
          text-decoration: none;
        }
        .suggestion-link:hover {
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
