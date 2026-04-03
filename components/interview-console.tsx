"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { completeSession, streamInterviewTurn } from "@/lib/client/api";
import { formatRolePackLabel, getInterviewerDefinition } from "@/lib/domain";
import type { InterviewSession, InterviewTurn, LiveTurnEvent } from "@/lib/domain";

type TurnView = {
  id: string;
  role: "candidate" | "interviewer";
  speakerLabel: string;
  content: string;
  kind: string;
};

const turnKindLabels: Record<string, string> = {
  question: "问题",
  follow_up: "追问",
  interrupt: "打断",
  conflict: "挑战",
  candidate: "候选人",
  system: "系统",
};

const thinkingStatusLabels: Record<string, string> = {
  director_analyzing: "正在分析你的上一段回答",
  selecting_speaker: "正在决定下一位追问者",
  generating_turn: "正在组织下一轮追问",
};

function formatTurnKind(kind: string) {
  return turnKindLabels[kind] ?? kind;
}

function formatThinkingStatus(status: string) {
  return thinkingStatusLabels[status] ?? "正在组织下一轮追问";
}

function mapTurn(turn: InterviewTurn): TurnView {
  return {
    id: turn.id,
    role: turn.role === "candidate" ? "candidate" : "interviewer",
    speakerLabel: turn.speakerLabel,
    content: turn.content,
    kind: turn.kind,
  };
}

function mapEvent(event: LiveTurnEvent): TurnView {
  return {
    id: event.id,
    role: "interviewer",
    speakerLabel: event.speakerLabel,
    content: event.message,
    kind: event.kind,
  };
}

export function InterviewConsole({
  session,
  turns,
}: {
  session: InterviewSession;
  turns: InterviewTurn[];
}) {
  const router = useRouter();
  const [pressure, setPressure] = useState(session.currentPressure);
  const [transcript, setTranscript] = useState<TurnView[]>(
    turns.filter((turn) => turn.role !== "system").map(mapTurn),
  );
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [thinkingStatus, setThinkingStatus] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [answerStartTime, setAnswerStartTime] = useState<number | null>(null);

  const sessionLocked = session.status !== "live";
  const currentRound = Math.max(1, session.directorState.round + 1);
  const interviewerLabels = session.config.interviewers.map(
    (interviewerId) =>
      getInterviewerDefinition(session.config.rolePack, interviewerId)?.label ?? interviewerId,
  );

  const handleAnswerChange = (value: string) => {
    setAnswer(value);
    if (!answerStartTime && value.length > 0) {
      setAnswerStartTime(Date.now());
    }
  };

  const sendAnswer = async () => {
    if (!answer.trim() || isStreaming || sessionLocked) {
      return;
    }

    const answerText = answer.trim();
    const elapsed = answerStartTime ? Math.round((Date.now() - answerStartTime) / 1000) : 0;
    setErrorMessage(null);
    setTranscript((current) => [
      ...current,
      {
        id: `candidate-${Date.now()}`,
        role: "candidate",
        speakerLabel: session.config.candidateName || "候选人",
        content: answerText,
        kind: "candidate",
      },
    ]);
    setAnswer("");
    setAnswerStartTime(null);
    setIsStreaming(true);

    try {
      await streamInterviewTurn({
        sessionId: session.id,
        answer: answerText,
        elapsedSeconds: elapsed,
        onEvent: (event) => {
          setThinkingStatus(null);
          setTranscript((current) => [...current, mapEvent(event)]);
          setPressure((current) => Math.min(100, Math.max(0, current + event.pressureDelta)));
        },
        onThinking: (status) => {
          setThinkingStatus(status);
        },
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "模拟请求失败");
    } finally {
      setIsStreaming(false);
      setThinkingStatus(null);
    }
  };

  const finalize = async () => {
    if (sessionLocked) {
      router.push(`/report/${session.id}`);
      return;
    }

    setErrorMessage(null);
    setIsCompleting(true);
    try {
      await completeSession(session.id);
      router.push(`/report/${session.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "无法生成复盘");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="stack-lg" data-testid="interview-console">
      <section className="console-summary-grid">
        <article className="workspace-card workspace-highlight-card">
          <div className="section-head">
            <div>
              <p className="panel-label">本轮目标</p>
              <h3>
                {session.config.targetCompany} · {session.config.level}
              </h3>
            </div>
            <div className="chip-row">
              <span className={`status-pill ${pressure >= 70 ? "warning" : ""}`}>
                当前压力 {pressure}
              </span>
              <span className="status-pill subtle">
                {formatRolePackLabel(session.config.rolePack)}岗位
              </span>
            </div>
          </div>
          <p className="hero-copy">
            这一页只做一件事: 在压力里把答案说清楚。结束后会自动进入复盘，不需要你再切到别的工具页。
          </p>
          <div className="chip-row">
            {interviewerLabels.map((label) => (
              <span key={label} className="workspace-pill">
                {label}
              </span>
            ))}
          </div>
        </article>

        <article className="workspace-card">
          <div className="section-head">
            <div>
              <p className="panel-label">当前进度</p>
              <h3>保持对话连续，不要抢答</h3>
            </div>
          </div>
          <div className="journey-summary-list">
            <div className="journey-summary-item">
              <strong>轮次</strong>
              <span>第 {currentRound} 轮</span>
            </div>
            <div className="journey-summary-item">
              <strong>回答结构</strong>
              <span>先结论，再证据，再权衡</span>
            </div>
            <div className="journey-summary-item">
              <strong>完成后</strong>
              <span>自动生成本轮复盘</span>
            </div>
          </div>
        </article>
      </section>

      <div className="journey-console-grid">
        <section className="panel">
          <div className="section-head">
            <div>
              <p className="panel-label">模拟训练</p>
              <h3>实时对话记录</h3>
            </div>
            {sessionLocked ? (
              <Link href={`/report/${session.id}`} className="secondary-button">
                查看本轮复盘
              </Link>
            ) : null}
          </div>
          <div className="transcript" data-testid="interview-transcript">
            {transcript.length === 0 ? (
              <article className="transcript-empty">
                <strong>准备开始后，这里会记录整场模拟。</strong>
                <p className="muted-copy">
                  你会先看到面试官发起问题，之后每一轮回答和追问都会按顺序保留，方便后面做复盘。
                </p>
              </article>
            ) : null}
            {transcript.map((turn) => (
              <article
                key={turn.id}
                className={`transcript-row ${turn.role === "candidate" ? "candidate" : ""}`}
                data-testid={`transcript-row-${turn.role}`}
              >
                <div className="transcript-meta">
                  <span>{turn.speakerLabel}</span>
                  <small>{formatTurnKind(turn.kind)}</small>
                </div>
                <p>{turn.content}</p>
              </article>
            ))}
            {isStreaming ? (
              <div
                className="console-streaming-state"
                aria-hidden
                data-testid="interview-streaming-indicator"
              >
                <div className="breathing-light" />
                <div className="terminal-caret" />
                {thinkingStatus ? (
                  <span className="muted-copy console-thinking-copy">
                    {formatThinkingStatus(thinkingStatus)}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="panel console-composer-panel">
          <div className="section-head">
            <div>
              <p className="panel-label">你的回答</p>
              <h3>{sessionLocked ? "本轮已结束" : "把这一轮说得更清楚"}</h3>
            </div>
          </div>
          <label className="field">
            <span>回答草稿</span>
            <textarea
              rows={7}
              value={answer}
              onChange={(event) => handleAnswerChange(event.target.value)}
              data-testid="interview-answer-input"
              placeholder="先用一句话给出结论，再补上关键证据、取舍和结果。"
              disabled={sessionLocked}
            />
          </label>

          <div className="console-guidance-list">
            <div className="console-guidance-item">
              <strong>先给结论</strong>
              <p>不要先铺垫背景，先说你的判断是什么。</p>
            </div>
            <div className="console-guidance-item">
              <strong>补上证据</strong>
              <p>尽量给出事实、数据、约束或你亲自做过的动作。</p>
            </div>
            <div className="console-guidance-item">
              <strong>说明取舍</strong>
              <p>如果有 tradeoff，直接讲清你为什么这样选。</p>
            </div>
          </div>

          <div className="action-row">
            <button
              type="button"
              className="primary-button"
              disabled={isStreaming || !answer.trim() || sessionLocked}
              data-testid="interview-send-button"
              onClick={() => {
                void sendAnswer();
              }}
            >
              {isStreaming ? "面试官正在追问..." : "发送回答"}
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={isCompleting}
              data-testid="interview-finish-button"
              onClick={() => {
                void finalize();
              }}
            >
              {sessionLocked
                ? "前往本轮复盘"
                : isCompleting
                  ? "正在生成复盘..."
                  : "结束本轮并生成复盘"}
            </button>
          </div>
          {sessionLocked ? (
            <p className="muted-copy">
              当前会话已经结束，输入区进入只读状态。你现在可以直接查看本轮复盘。
            </p>
          ) : null}
          {errorMessage ? (
            <p className="error-copy" data-testid="interview-error-message">
              {errorMessage}
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
