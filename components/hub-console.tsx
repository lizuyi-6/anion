"use client";

import { useState } from "react";

import { DiagramView } from "@/components/diagram-view";
import { TimelineView } from "@/components/timeline-view";
import { buildCommandInput, commandArtifactToMarkdown, type CopilotBrief, type SandboxBrief, type StrategyBrief } from "@/lib/command-artifacts";
import { runCommandModeApi, uploadFiles } from "@/lib/client/api";
import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMessage,
  CommandMode,
  UploadReference,
} from "@/lib/domain";

const defaultCopilotBrief: CopilotBrief = {
  issueType: "线上故障",
  runtime: "production / browser",
  suspectedLayer: "状态边界",
  desiredOutcome: "最短安全修复路径",
};

const defaultStrategyBrief: StrategyBrief = {
  deliverable: "PRD + FSR",
  targetUser: "内部业务团队",
  constraints: "两周内给出 MVP 路线",
  timeline: "6-8 周",
};

const defaultSandboxBrief: SandboxBrief = {
  counterpartRole: "跨部门负责人",
  incentives: "保控制权，少背责任",
  redLine: "不能失去核心接口控制权",
  meetingWindow: "本周三对齐会",
};

function runLabel(mode: CommandMode) {
  switch (mode) {
    case "copilot":
      return "Run Copilot";
    case "strategy":
      return "Generate FSR";
    case "sandbox":
      return "Simulate Scenario";
  }
}

export function HubConsole({
  mode,
  title,
  description,
  memoryContext,
  initialHistory = [],
}: {
  mode: CommandMode;
  title: string;
  description: string;
  memoryContext: ActiveMemoryContext | null;
  initialHistory?: CommandMessage[];
}) {
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>(undefined);
  const [history, setHistory] = useState<CommandMessage[]>(initialHistory);
  const [artifact, setArtifact] = useState<CommandArtifact | null>(null);
  const [attachments, setAttachments] = useState<UploadReference[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [copilotBrief, setCopilotBrief] = useState(defaultCopilotBrief);
  const [strategyBrief, setStrategyBrief] = useState(defaultStrategyBrief);
  const [sandboxBrief, setSandboxBrief] = useState(defaultSandboxBrief);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const uploads = await uploadFiles(files);
    setAttachments((current) => [...current, ...uploads]);
  };

  const onSubmit = async () => {
    if (!input.trim() || isRunning) {
      return;
    }

    const compiledInput =
      mode === "copilot"
        ? buildCommandInput({
            mode,
            narrative: input,
            brief: copilotBrief,
          })
        : mode === "strategy"
          ? buildCommandInput({
              mode,
              narrative: input,
              brief: strategyBrief,
            })
          : buildCommandInput({
              mode,
              narrative: input,
              brief: sandboxBrief,
            });

    setIsRunning(true);
    try {
      const result = await runCommandModeApi({
        mode,
        threadId,
        input: compiledInput,
        attachments,
      });
      setThreadId(result.threadId);
      setHistory(result.history);
      setArtifact(result.artifact);
      setInput("");
      setAttachments([]);
    } finally {
      setIsRunning(false);
    }
  };

  const onExport = () => {
    if (!artifact) {
      return;
    }

    const blob = new Blob([commandArtifactToMarkdown(artifact)], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mobius-${artifact.mode}-${new Date().toISOString().slice(0, 10)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const profile = memoryContext?.profile ?? null;

  return (
    <div className="stack-lg">
      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">Command Center</p>
            <h3>{title}</h3>
          </div>
        </div>
        <p className="hero-copy">{description}</p>
        {profile ? (
          <div className="stack-md">
            <div className="chip-row">
              {profile.skills.slice(0, 2).map((item) => (
                <span key={item.label} className="status-pill subtle">
                  {item.label}
                </span>
              ))}
              {profile.gaps.slice(0, 2).map((item) => (
                <span key={item.label} className="status-pill warning">
                  {item.label}
                </span>
              ))}
            </div>
            {memoryContext?.timeline.length ? (
              <div className="memory-reel">
                {memoryContext.timeline.slice(0, 4).map((moment) => (
                  <article key={moment.id} className="memory-card">
                    <span className="eyebrow">{moment.title}</span>
                    <p>{moment.summary}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="muted-copy">
            还没有激活记忆图谱。先完成一场面试并点击 Accept Offer。
          </p>
        )}
      </div>

      <div className="panel">
        <div className="mode-brief-grid">
          {mode === "copilot" ? (
            <>
              <label className="field">
                <span>问题类型</span>
                <input
                  value={copilotBrief.issueType}
                  onChange={(event) =>
                    setCopilotBrief((current) => ({
                      ...current,
                      issueType: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>运行环境</span>
                <input
                  value={copilotBrief.runtime}
                  onChange={(event) =>
                    setCopilotBrief((current) => ({
                      ...current,
                      runtime: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>疑似层级</span>
                <input
                  value={copilotBrief.suspectedLayer}
                  onChange={(event) =>
                    setCopilotBrief((current) => ({
                      ...current,
                      suspectedLayer: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>期望输出</span>
                <input
                  value={copilotBrief.desiredOutcome}
                  onChange={(event) =>
                    setCopilotBrief((current) => ({
                      ...current,
                      desiredOutcome: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : null}

          {mode === "strategy" ? (
            <>
              <label className="field">
                <span>目标交付物</span>
                <input
                  value={strategyBrief.deliverable}
                  onChange={(event) =>
                    setStrategyBrief((current) => ({
                      ...current,
                      deliverable: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>目标对象</span>
                <input
                  value={strategyBrief.targetUser}
                  onChange={(event) =>
                    setStrategyBrief((current) => ({
                      ...current,
                      targetUser: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>关键约束</span>
                <input
                  value={strategyBrief.constraints}
                  onChange={(event) =>
                    setStrategyBrief((current) => ({
                      ...current,
                      constraints: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>预期时间线</span>
                <input
                  value={strategyBrief.timeline}
                  onChange={(event) =>
                    setStrategyBrief((current) => ({
                      ...current,
                      timeline: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : null}

          {mode === "sandbox" ? (
            <>
              <label className="field">
                <span>对手角色</span>
                <input
                  value={sandboxBrief.counterpartRole}
                  onChange={(event) =>
                    setSandboxBrief((current) => ({
                      ...current,
                      counterpartRole: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>对手激励</span>
                <input
                  value={sandboxBrief.incentives}
                  onChange={(event) =>
                    setSandboxBrief((current) => ({
                      ...current,
                      incentives: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>你的红线</span>
                <input
                  value={sandboxBrief.redLine}
                  onChange={(event) =>
                    setSandboxBrief((current) => ({
                      ...current,
                      redLine: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>会议窗口</span>
                <input
                  value={sandboxBrief.meetingWindow}
                  onChange={(event) =>
                    setSandboxBrief((current) => ({
                      ...current,
                      meetingWindow: event.target.value,
                    }))
                  }
                />
              </label>
            </>
          ) : null}
        </div>

        <label className="field">
          <span>任务原文</span>
          <textarea
            rows={6}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="把真实问题扔进来，系统会把结构化 brief 和你的原始叙述合并成更可执行的请求。"
          />
        </label>
        <label className="upload-box">
          <span>上传日志、文档或补充材料</span>
          <input
            type="file"
            multiple
            onChange={(event) => {
              void onUpload(event.target.files);
            }}
          />
        </label>
        {attachments.length > 0 ? (
          <div className="chip-row">
            {attachments.map((attachment) => (
              <span key={attachment.id} className="status-pill subtle">
                {attachment.originalName}
              </span>
            ))}
          </div>
        ) : null}
        <button
          type="button"
          className="primary-button"
          disabled={isRunning || !input.trim()}
          onClick={() => {
            void onSubmit();
          }}
        >
          {isRunning ? "Thinking..." : runLabel(mode)}
        </button>
      </div>

      {history.length > 0 ? (
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="panel-label">Thread</p>
              <h3>多轮记录</h3>
            </div>
          </div>
          <div className="transcript">
            {history.map((message) => (
              <article
                key={message.id}
                className={`transcript-row ${message.role === "user" ? "candidate" : ""}`}
              >
                <div className="transcript-meta">
                  <span>{message.role === "user" ? "You" : "Mobius"}</span>
                </div>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {artifact?.mode === "strategy" ? (
        <div className="stack-lg">
          <div className="panel">
            <div className="section-head">
              <div>
                <p className="panel-label">FSR</p>
                <h3>可行性研究报告</h3>
              </div>
              <button type="button" className="secondary-button inline-button" onClick={onExport}>
                Export Markdown
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
                  <span key={item} className="status-pill subtle">
                    {item}
                  </span>
                ))}
                {artifact.successMetrics.map((item) => (
                  <span key={item} className="status-pill">
                    {item}
                  </span>
                ))}
              </div>
              {artifact.assumptions.length > 0 ? (
                <article className="report-block">
                  <h4>Assumptions</h4>
                  <ul className="flat-list">
                    {artifact.assumptions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {artifact.openQuestions.length > 0 ? (
                <article className="report-block">
                  <h4>Open Questions</h4>
                  <ul className="flat-list">
                    {artifact.openQuestions.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ) : null}
              {artifact.citations.length > 0 ? (
                <div className="stack-sm">
                  <h4>引用</h4>
                  {artifact.citations.map((citation) => (
                    <a
                      key={citation.url}
                      href={citation.url}
                      target="_blank"
                      rel="noreferrer"
                      className="citation-link"
                    >
                      {citation.title}
                    </a>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <DiagramView spec={artifact.diagramSpec} />
          <TimelineView spec={artifact.timelineSpec} />
        </div>
      ) : null}

      {artifact?.mode === "copilot" ? (
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="panel-label">Copilot Output</p>
              <h3>工程副驾建议</h3>
            </div>
          </div>
          <div className="stack-md">
            <article className="report-block">
              <h4>Root Cause</h4>
              <p>{artifact.rootCause}</p>
            </article>
            <article className="report-block">
              <h4>Memory Anchor</h4>
              <p>{artifact.memoryAnchor}</p>
            </article>
            <article className="report-block">
              <h4>Shortest Fix</h4>
              <ul className="flat-list">
                {artifact.shortestFix.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="report-block">
              <h4>Optional Refactors</h4>
              <ul className="flat-list">
                {artifact.optionalRefactors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            {artifact.watchouts.length > 0 ? (
              <article className="report-block">
                <h4>Watchouts</h4>
                <ul className="flat-list">
                  {artifact.watchouts.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}
          </div>
        </div>
      ) : null}

      {artifact?.mode === "sandbox" ? (
        <div className="panel">
          <div className="section-head">
            <div>
              <p className="panel-label">Game Theory Sandbox</p>
              <h3>局势复盘</h3>
            </div>
          </div>
          <div className="stack-md">
            <article className="report-block">
              <h4>Counterpart Model</h4>
              <p>{artifact.counterpartModel.style}</p>
              <ul className="flat-list">
                {artifact.counterpartModel.incentives.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article className="report-block">
              <h4>Current Equilibrium</h4>
              <p>{artifact.equilibrium}</p>
            </article>
            <article className="report-block">
              <h4>Recommended Move</h4>
              <p>{artifact.recommendedMove}</p>
            </article>
            {artifact.pressurePoints.length > 0 ? (
              <article className="report-block">
                <h4>Pressure Points</h4>
                <ul className="flat-list">
                  {artifact.pressurePoints.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>
            ) : null}
            <article className="report-block">
              <h4>Talk Tracks</h4>
              <ul className="flat-list">
                {artifact.talkTracks.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            {artifact.scenarioBranches.length > 0 ? (
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
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
