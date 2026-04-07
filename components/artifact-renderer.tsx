"use client";

import type { CommandArtifact, CommandMode } from "@/lib/domain";
import { DiagramView } from "@/components/diagram-view";
import { PayoffMatrix } from "@/components/payoff-matrix";
import { TimelineView } from "@/components/timeline-view";
import { commandArtifactToMarkdown } from "@/lib/command-artifacts";

interface ArtifactRendererProps {
  artifact: CommandArtifact;
  mode: CommandMode;
}

export function ArtifactRenderer({ artifact, mode }: ArtifactRendererProps) {
  if (mode === "copilot" && artifact.mode === "copilot") {
    return <CopilotArtifact artifact={artifact} />;
  }

  if (mode === "strategy" && artifact.mode === "strategy") {
    return <StrategyArtifact artifact={artifact} />;
  }

  if (mode === "sandbox" && artifact.mode === "sandbox") {
    return <SandboxArtifact artifact={artifact} />;
  }

  return <p>{JSON.stringify(artifact).slice(0, 200)}</p>;
}

function CopilotArtifact({ artifact }: { artifact: Extract<CommandArtifact, { mode: "copilot" }> }) {
  return (
    <div className="stack-md">
      <article className="report-block">
        <h4>根本原因</h4>
        <p>{artifact.rootCause}</p>
      </article>
      <article className="report-block">
        <h4>记忆锚点</h4>
        <p>{artifact.memoryAnchor}</p>
      </article>
      <article className="report-block">
        <h4>最短修复路径</h4>
        <ul className="flat-list">
          {artifact.shortestFix.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </article>
      <article className="report-block">
        <h4>可选重构</h4>
        <ul className="flat-list">
          {artifact.optionalRefactors.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </article>
      {artifact.watchouts.length > 0 && (
        <article className="report-block">
          <h4>注意事项</h4>
          <ul className="flat-list">
            {artifact.watchouts.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>
      )}
      {artifact.techForesight.length > 0 && (
        <article className="report-block">
          <h4>前瞻性技术预判</h4>
          <div className="card-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {artifact.techForesight.map((item) => (
              <article key={item.technology} className="report-block" style={{ borderLeft: `3px solid var(--${item.risk === "high" ? "warning" : item.risk === "medium" ? "accent" : "--line-strong"})` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong>{item.technology}</strong>
                  <span
                    className="status-pill"
                    style={{
                      fontSize: "0.68rem",
                      ...(item.risk === "high"
                        ? { background: "rgba(217, 119, 6, 0.15)", color: "#b45309" }
                        : item.risk === "medium"
                          ? { background: "var(--accent-soft)", color: "var(--accent)" }
                          : { background: "rgba(0,0,0,0.04)", color: "var(--muted)" }),
                    }}
                  />
                </div>
                <p className="muted-copy" style={{ fontSize: "0.82rem" }}>{item.timeline}</p>
                <p>{item.recommendation}</p>
              </article>
            ))}
          </div>
        </article>
      )}
    </div>
  );
}

function StrategyArtifact({ artifact }: { artifact: Extract<CommandArtifact, { mode: "strategy" }> }) {
  const onExport = () => {
    const md = commandArtifactToMarkdown(artifact);
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mobius-strategy-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="stack-lg">
      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">可研报告</p>
            <h3>可行性研究报告</h3>
          </div>
          <button type="button" className="secondary-button inline-button" onClick={onExport}>
            导出Markdown
          </button>
        </div>
        <div className="stack-md">
          {artifact.sections.map((section) => (
            <article key={section.id} className="report-block">
              <h4>{section.title}</h4>
              <p>{section.body}</p>
            </article>
          ))}
          <div className="chip-row">
            {artifact.deliverables.map((item) => (
              <span key={item} className="status-pill subtle">{item}</span>
            ))}
            {artifact.successMetrics.map((item) => (
              <span key={item} className="status-pill">{item}</span>
            ))}
          </div>
          {artifact.assumptions.length > 0 && (
            <article className="report-block">
              <h4>假设条件</h4>
              <ul className="flat-list">
                {artifact.assumptions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          )}
          {artifact.openQuestions.length > 0 && (
            <article className="report-block">
              <h4>待解决问题</h4>
              <ul className="flat-list">
                {artifact.openQuestions.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </article>
          )}
          {artifact.citations.length > 0 && (
            <div className="stack-sm">
              <h4>引用</h4>
              {artifact.citations.map((citation) => (
                <a key={citation.url} href={citation.url} target="_blank" rel="noreferrer" className="citation-link">
                  {citation.title}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
      <DiagramView spec={artifact.diagramSpec} />
      <TimelineView spec={artifact.timelineSpec} />
    </div>
  );
}

function SandboxArtifact({ artifact }: { artifact: Extract<CommandArtifact, { mode: "sandbox" }> }) {
  return (
    <div className="stack-md">
      <article className="report-block">
        <h4>对手模型</h4>
        <p>{artifact.counterpartModel.style}</p>
        <ul className="flat-list">
          {artifact.counterpartModel.incentives.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </article>
      <article className="report-block">
        <h4>当前均衡点</h4>
        <p>{artifact.equilibrium}</p>
      </article>
      <article className="report-block">
        <h4>推荐行动</h4>
        <p>{artifact.recommendedMove}</p>
      </article>
      {artifact.pressurePoints.length > 0 && (
        <article className="report-block">
          <h4>施压点</h4>
          <ul className="flat-list">
            {artifact.pressurePoints.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </article>
      )}
      <article className="report-block">
        <h4>话术要点</h4>
        <ul className="flat-list">
          {artifact.talkTracks.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </article>
      {artifact.scenarioBranches.length > 0 && (
        <div className="card-grid">
          {artifact.scenarioBranches.map((branch) => (
            <article key={branch.name} className="report-block">
              <h4>{branch.name}</h4>
              <p>{branch.ifYouPush}</p>
              <p className="muted-copy">{branch.ifYouConcede}</p>
              <p className="muted-copy">{branch.signalToWatch}</p>
            </article>
          ))}
        </div>
      )}
      {artifact.payoffMatrix && <PayoffMatrix data={artifact.payoffMatrix} />}
    </div>
  );
}
