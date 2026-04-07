import type { SkillTrend } from "@/lib/domain";

interface SkillEvolutionChartProps {
  skillsTrend: SkillTrend[];
}

function getTrendIcon(trend: "improving" | "declining" | "stable"): string {
  switch (trend) {
    case "improving":
      return "↑";
    case "declining":
      return "↓";
    case "stable":
      return "→";
  }
}

function getTrendColor(trend: "improving" | "declining" | "stable"): string {
  switch (trend) {
    case "improving":
      return "var(--success)";
    case "declining":
      return "var(--error)";
    case "stable":
      return "var(--text-secondary)";
  }
}

// Simple sparkline SVG generator
function generateSparkline(
  history: Array<{ confidence: number }>,
  width: number = 60,
  height: number = 24
): string {
  if (history.length < 2) return "";

  const points = history.map((h, i) => {
    const x = (i / (history.length - 1)) * width;
    const y = height - h.confidence * height;
    return `${x},${y}`;
  });

  return `M ${points.join(" L ")}`;
}

export function SkillEvolutionChart({ skillsTrend }: SkillEvolutionChartProps) {
  if (skillsTrend.length === 0) {
    return (
      <div className="skill-evolution-empty">
        <p className="muted-copy">
          完成多轮训练后，这里会展示你的技能演进曲线。
        </p>
        <style>{`
          .skill-evolution-empty {
            padding: 1rem;
          }
        `}</style>
      </div>
    );
  }

  // Show top 6 skills
  const displayedSkills = skillsTrend.slice(0, 6);

  return (
    <div className="skill-evolution-chart">
      <div className="skill-list">
        {displayedSkills.map((skill) => {
          const latestConfidence =
            skill.confidenceHistory[skill.confidenceHistory.length - 1]
              ?.confidence ?? 0;
          const sparkline = generateSparkline(skill.confidenceHistory);

          return (
            <div key={skill.label} className="skill-row">
              <div className="skill-info">
                <span
                  className="skill-trend"
                  style={{ color: getTrendColor(skill.trend) }}
                >
                  {getTrendIcon(skill.trend)}
                </span>
                <span className="skill-label">{skill.label}</span>
              </div>
              <div className="skill-visual">
                {sparkline && (
                  <svg
                    className="skill-sparkline"
                    width="60"
                    height="24"
                    viewBox="0 0 60 24"
                  >
                    <path
                      d={sparkline}
                      fill="none"
                      stroke="var(--border-default)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
                <span className="skill-confidence">
                  {Math.round(latestConfidence * 100)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .skill-evolution-chart {
          padding: 0.5rem 0;
        }
        .skill-list {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .skill-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0.5rem 0;
          border-bottom: 1px solid var(--border-subtle);
        }
        .skill-row:last-child {
          border-bottom: none;
        }
        .skill-info {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .skill-trend {
          font-size: 0.875rem;
          font-weight: 600;
        }
        .skill-label {
          font-size: 0.875rem;
          color: var(--text-primary);
        }
        .skill-visual {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .skill-sparkline {
          opacity: 0.6;
        }
        .skill-confidence {
          font-size: 0.8125rem;
          font-weight: 500;
          color: var(--text-secondary);
          min-width: 2.5rem;
          text-align: right;
        }
      `}</style>
    </div>
  );
}
