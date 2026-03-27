"use client";

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
  conflict: "冲突",
  candidate: "候选人",
  system: "系统",
};

function formatTurnKind(kind: string) {
  return turnKindLabels[kind] ?? kind;
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

  const handleAnswerChange = (value: string) => {
    setAnswer(value);
    if (!answerStartTime && value.length > 0) {
      setAnswerStartTime(Date.now());
    }
  };

  const sendAnswer = async () => {
    if (!answer.trim() || isStreaming) {
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
        speakerLabel: session.config.candidateName ?? "候选人",
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
      setErrorMessage(error instanceof Error ? error.message : "Interview request failed");
    } finally {
      setIsStreaming(false);
      setThinkingStatus(null);
    }
  };

  const finalize = async () => {
    setErrorMessage(null);
    setIsCompleting(true);
    try {
      await completeSession(session.id);
      router.push(`/report/${session.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to generate report");
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="stack-lg" data-testid="interview-console">
      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">A2 / 动态博弈</p>
            <h3>实时多轮对话</h3>
          </div>
          <div className="chip-row">
            <span className="status-pill">压力值 {pressure}</span>
            <span className="status-pill subtle">{formatRolePackLabel(session.config.rolePack)}</span>
          </div>
        </div>
        <div className="chip-row">
          {session.config.interviewers.map((interviewerId) => (
            <span key={interviewerId} className="status-pill subtle">
              {getInterviewerDefinition(session.config.rolePack, interviewerId)?.label ??
                interviewerId}
            </span>
          ))}
        </div>
        <div className="transcript" data-testid="interview-transcript">
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }} aria-hidden data-testid="interview-streaming-indicator">
              <div className="breathing-light" />
              <div className="terminal-caret" />
              {thinkingStatus ? (
                <span className="muted-copy" style={{ fontSize: "0.78rem", fontFamily: "var(--font-mono)" }}>{thinkingStatus === "director_analyzing" ? "导演分析中…" : thinkingStatus}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <div className="panel">
        <label className="field">
          <span>你的回答</span>
          <textarea
            rows={6}
            value={answer}
            onChange={(event) => handleAnswerChange(event.target.value)}
            data-testid="interview-answer-input"
            placeholder="给出一个短、硬、可验证的回答。先结论，再补证据。"
          />
        </label>
        <div className="action-row">
          <button
            type="button"
            className="primary-button"
            disabled={isStreaming || !answer.trim()}
            data-testid="interview-send-button"
            onClick={() => {
              void sendAnswer();
            }}
          >
            {isStreaming ? "面试官正在追压..." : "发送回答"}
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
            {isCompleting ? "分析中..." : "结束本场面试"}
          </button>
        </div>
        {errorMessage ? (
          <p className="error-copy" data-testid="interview-error-message">
            {errorMessage}
          </p>
        ) : null}
      </div>
    </div>
  );
}
