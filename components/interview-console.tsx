"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { completeSession, streamInterviewTurn } from "@/lib/client/api";
import { getInterviewerDefinition } from "@/lib/domain";
import type { InterviewSession, InterviewTurn, LiveTurnEvent } from "@/lib/domain";

type TurnView = {
  id: string;
  role: "candidate" | "interviewer";
  speakerLabel: string;
  content: string;
  kind: string;
};

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
  const [isCompleting, setIsCompleting] = useState(false);
  const currentPressure = useMemo(() => pressure, [pressure]);

  const sendAnswer = async () => {
    if (!answer.trim() || isStreaming) {
      return;
    }

    const answerText = answer.trim();
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
    setIsStreaming(true);

    try {
      await streamInterviewTurn({
        sessionId: session.id,
        answer: answerText,
        elapsedSeconds: 90,
        onEvent: (event) => {
          setTranscript((current) => [...current, mapEvent(event)]);
          setPressure((current) => Math.min(100, Math.max(0, current + event.pressureDelta)));
        },
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const finalize = async () => {
    setIsCompleting(true);
    try {
      await completeSession(session.id);
      router.push(`/report/${session.id}`);
      router.refresh();
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="stack-lg">
      <div className="panel">
        <div className="section-head">
          <div>
            <p className="panel-label">A2 / 动态博弈</p>
            <h3>实时多轮对弈</h3>
          </div>
          <div className="chip-row">
            <span className="status-pill">压力值 {currentPressure}</span>
            <span className="status-pill subtle">{session.config.rolePack}</span>
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
        <div className="transcript">
          {transcript.map((turn) => (
            <article
              key={turn.id}
              className={`transcript-row ${turn.role === "candidate" ? "candidate" : ""}`}
            >
              <div className="transcript-meta">
                <span>{turn.speakerLabel}</span>
                <small>{turn.kind}</small>
              </div>
              <p>{turn.content}</p>
            </article>
          ))}
          {isStreaming ? <div className="terminal-caret" aria-hidden /> : null}
        </div>
      </div>

      <div className="panel">
        <label className="field">
          <span>你的回答</span>
          <textarea
            rows={6}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            placeholder="给出一个短、硬、可验证的回答。先结论，再补证据。"
          />
        </label>
        <div className="action-row">
          <button
            type="button"
            className="primary-button"
            disabled={isStreaming || !answer.trim()}
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
            onClick={() => {
              void finalize();
            }}
          >
            {isCompleting ? "分析中..." : "结束本场面试"}
          </button>
        </div>
      </div>
    </div>
  );
}
