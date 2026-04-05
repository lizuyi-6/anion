"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { completeSession, streamInterviewTurn } from "@/lib/client/api";
import {
  formatPressurePhaseLabel,
  formatRolePackLabel,
  getInterviewerDefinition,
  getPressureDeadlineSeconds,
  getPressurePhaseForRound,
  type InterviewPressurePhase,
} from "@/lib/domain";
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

const phaseDescriptions: Record<InterviewPressurePhase, string> = {
  calibrate: "先校准主论点，抓跑题、冗长和空泛。",
  surround: "第二位面试官接力围压，逼近证据、取舍和 owner。",
  crossfire: "进入交叉火力，任何漏洞都会被双人追杀。",
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
  const [currentRound, setCurrentRound] = useState(
    Math.max(1, session.directorState.round + 1),
  );
  const [phase, setPhase] = useState(session.directorState.phase);
  const [deadlineSeconds, setDeadlineSeconds] = useState(
    getPressureDeadlineSeconds(session.directorState.phase),
  );
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(
    getPressureDeadlineSeconds(session.directorState.phase),
  );
  const [draftLocked, setDraftLocked] = useState(false);
  const [activeSeam, setActiveSeam] = useState(
    session.directorState.activeSeam || session.config.focusGoal || "把回答钉在主决策链路上",
  );
  const [pressureReasons, setPressureReasons] = useState(
    session.directorState.lastPressureReasons,
  );
  const [timeoutCount, setTimeoutCount] = useState(session.directorState.timeoutCount);
  const [activePressureSpeakers, setActivePressureSpeakers] = useState<string[]>([]);

  const sessionLocked = session.status !== "live";
  const interviewerLabels = session.config.interviewers.map(
    (interviewerId) =>
      getInterviewerDefinition(session.config.rolePack, interviewerId)?.label ?? interviewerId,
  );

  useEffect(() => {
    if (!answerStartTime || sessionLocked || draftLocked || isStreaming) {
      setTimeLeftSeconds(deadlineSeconds);
      return;
    }

    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - answerStartTime) / 1000);
      const remaining = Math.max(0, deadlineSeconds - elapsed);
      setTimeLeftSeconds(remaining);

      if (remaining <= 0) {
        window.clearInterval(timer);
        setDraftLocked(true);
        setErrorMessage("本轮作答时间已到，输入已锁定。提交当前草稿后，系统会继续追压。");
      }
    }, 250);

    return () => {
      window.clearInterval(timer);
    };
  }, [answerStartTime, deadlineSeconds, draftLocked, isStreaming, sessionLocked]);

  const handleAnswerChange = (value: string) => {
    if (draftLocked) {
      return;
    }

    setAnswer(value);
    if (value.length === 0) {
      setAnswerStartTime(null);
      setTimeLeftSeconds(deadlineSeconds);
    }
    if (!answerStartTime && value.length > 0) {
      setAnswerStartTime(Date.now());
    }
  };

  const sendAnswer = async () => {
    if (!answer.trim() || isStreaming || sessionLocked) {
      return;
    }

    const answerText = answer.trim();
    const elapsed = draftLocked
      ? deadlineSeconds
      : answerStartTime
        ? Math.round((Date.now() - answerStartTime) / 1000)
        : 0;
    const timerExpired = draftLocked || elapsed >= deadlineSeconds;
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
    setDraftLocked(false);
    setIsStreaming(true);

    try {
      const streamedEvents: LiveTurnEvent[] = [];
      await streamInterviewTurn({
        sessionId: session.id,
        answer: answerText,
        elapsedSeconds: elapsed,
        timerExpired,
        onEvent: (event) => {
          streamedEvents.push(event);
          setThinkingStatus(null);
          setTranscript((current) => [...current, mapEvent(event)]);
          setPressure((current) => Math.min(100, Math.max(0, current + event.pressureDelta)));
          setActiveSeam((current) => event.seamLabel || current);
          setPressureReasons((current) =>
            event.pressureReason
              ? [event.pressureReason, ...current].slice(0, 3)
              : current,
          );
        },
        onThinking: (status) => {
          setThinkingStatus(status);
        },
      });

      const nextRound = currentRound + 1;
      const nextPhase = getPressurePhaseForRound(nextRound);
      setCurrentRound(nextRound);
      setPhase(nextPhase);
      setDeadlineSeconds(getPressureDeadlineSeconds(nextPhase));
      setTimeLeftSeconds(getPressureDeadlineSeconds(nextPhase));
      setTimeoutCount((current) => current + (timerExpired ? 1 : 0));
      setActivePressureSpeakers(
        [...new Set(streamedEvents.map((event) => event.speakerLabel))],
      );
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
              <span className={`status-pill ${timeLeftSeconds <= 15 ? "warning" : "subtle"}`}>
                本轮倒计时 {timeLeftSeconds}s
              </span>
              <span className="status-pill subtle">
                {formatRolePackLabel(session.config.rolePack)}岗位
              </span>
            </div>
          </div>
          <p className="hero-copy">
            这一页只做一件事: 在压力里把答案说清楚。结束后会自动进入复盘，不需要你再切到别的工具页。
          </p>
          <div className="pressure-phase-track" data-testid="pressure-phase-track">
            {(["calibrate", "surround", "crossfire"] as InterviewPressurePhase[]).map((item) => {
              const itemDeadline = getPressureDeadlineSeconds(item);
              const itemIndex = ["calibrate", "surround", "crossfire"].indexOf(item);
              const currentIndex = ["calibrate", "surround", "crossfire"].indexOf(phase);
              const state =
                itemIndex < currentIndex ? "done" : item === phase ? "active" : "upcoming";

              return (
                <div key={item} className={`pressure-phase-step ${state}`}>
                  <strong>{formatPressurePhaseLabel(item)}</strong>
                  <span>{itemDeadline}s</span>
                </div>
              );
            })}
          </div>
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
              <strong>压力阶段</strong>
              <span>{formatPressurePhaseLabel(phase)}</span>
            </div>
            <div className="journey-summary-item">
              <strong>本轮缝隙</strong>
              <span>{activeSeam}</span>
            </div>
            <div className="journey-summary-item">
              <strong>超时记录</strong>
              <span>{timeoutCount} 次</span>
            </div>
            <div className="journey-summary-item">
              <strong>完成后</strong>
              <span>自动生成本轮复盘</span>
            </div>
          </div>
          <p className="muted-copy">{phaseDescriptions[phase]}</p>
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
              disabled={sessionLocked || draftLocked}
            />
          </label>

          <div className="pressure-status-card">
            <div className="chip-row">
              <span className="workspace-pill primary">
                {formatPressurePhaseLabel(phase)}
              </span>
              <span className={`workspace-pill ${draftLocked ? "warning" : ""}`}>
                当前时限 {deadlineSeconds}s
              </span>
            </div>
            <p>{activeSeam}</p>
            {activePressureSpeakers.length > 0 ? (
              <p className="muted-copy">
                围压中: {activePressureSpeakers.join(" / ")}
              </p>
            ) : null}
            {pressureReasons.length > 0 ? (
              <ul className="flat-list">
                {pressureReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            ) : null}
          </div>

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
              {isStreaming
                ? "面试官正在追问..."
                : draftLocked
                  ? "超时后继续追压"
                  : "发送回答"}
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
          {draftLocked ? (
            <p className="muted-copy" data-testid="interview-timeout-lock">
              当前草稿已因超时锁定。提交后，系统会按超时状态继续围压。
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
