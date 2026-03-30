"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { ThemeToggle } from "@/components/theme-toggle";
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

const interviewerPortrait =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuAPkgOD1h7LdVqZ4HkSug3BmyMUruVM5XPGdiNSwBMFjeHpWUxnkUDwhRyUwGMQASbf2hRva7lhVYGZoa0C0nObyCGGLOxM_sJUmnKUklBtSo3OhDpTks7BshKqgbQuNJDTfFcyB4353Z92wduAX28nqHKqsJ4vmKIJIBZwHwBN4wLxo914gMnxiOJkkILaoQEErPLfir7X1gqnc8OXpRLs3_ZFWL_cxzfEZg8KHVML9Gj_tewKSxWj2WX4Xk5xUVT6Qqfj3nI4U7w";

const turnKindLabels: Record<string, string> = {
  question: "Question",
  follow_up: "Follow-up",
  interrupt: "Interrupt",
  conflict: "Conflict",
  candidate: "Candidate",
  system: "System",
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

  const interviewer = getInterviewerDefinition(
    session.config.rolePack,
    session.directorState.nextSpeakerId,
  );
  const currentPrompt =
    [...transcript].reverse().find((turn) => turn.role === "interviewer")?.content ??
    "The interviewer is preparing the next prompt.";
  const interviewerTurns = transcript.filter((turn) => turn.role === "interviewer").length;
  const totalQuestions = Math.max(6, session.config.interviewers.length + 3);
  const progress = Math.min(100, Math.round((interviewerTurns / totalQuestions) * 100));

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
        speakerLabel: session.config.candidateName?.trim() || "Candidate",
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
    <div className="interview-workspace" data-testid="interview-console">
      <header className="workspace-topbar">
        <div className="workspace-brand-row">
          <Link href="/" className="workspace-brand">
            Mobius Project
          </Link>
          <nav className="workspace-primary-nav" aria-label="Primary navigation">
            <Link href="/" className="workspace-primary-link">
              Home
            </Link>
            <Link href="/simulator/new" className="workspace-primary-link active">
              Simulator
            </Link>
            <Link href="/hub" className="workspace-primary-link">
              Hub
            </Link>
          </nav>
        </div>
        <div className="workspace-user-tools">
          <span className="status-pill subtle">
            <span className="breathing-light" aria-hidden="true" />
            Live interview running
          </span>
          <ThemeToggle />
        </div>
      </header>

      {errorMessage ? (
        <div className="interview-error-banner">
          <p className="error-copy" data-testid="interview-error-message">
            {errorMessage}
          </p>
        </div>
      ) : null}

      <main className="interview-stage">
        <aside className="interview-rail" aria-hidden="true">
          <div className="interview-rail-button">M</div>
          <div className="interview-rail-button">V</div>
          <div className="interview-rail-button">T</div>
        </aside>

        <section className="interview-main-column">
          <div className="interview-avatar-panel">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={interviewerPortrait}
              alt="AI interviewer"
              className="interview-avatar-image"
            />
            <div className="interview-tone-chip">Pressure {pressure}</div>
            <div className="interview-avatar-badge">
              <div className="interview-avatar-mark">AI</div>
              <div>
                <p>Interviewer</p>
                <strong>{interviewer?.label ?? "Mobius interviewer"}</strong>
              </div>
            </div>
          </div>

          <section className="interview-question-panel">
            <p className="panel-label">Current prompt</p>
            <h2>{currentPrompt}</h2>
            <p className="hero-copy">
              Track: {formatRolePackLabel(session.config.rolePack)} · {session.config.targetCompany}
            </p>
          </section>
        </section>

        <aside className="interview-side-column">
          <section className="interview-transcript-panel">
            <div className="interview-live-row">
              <strong>Live transcript</strong>
              <span className="interview-live-badge">LIVE</span>
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
                <div className="chip-row" aria-hidden="true">
                  <div className="breathing-light" />
                  <div className="terminal-caret" />
                  {thinkingStatus ? (
                    <span className="muted-copy">
                      {thinkingStatus === "director_analyzing"
                        ? "Director is analyzing..."
                        : thinkingStatus}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>

          <section className="interview-progress-panel">
            <div className="interview-progress-row">
              <div>
                <p className="panel-label">Simulation progress</p>
                <p className="muted-copy">Round coverage and pressure pacing</p>
              </div>
              <div>
                <strong>
                  {Math.min(interviewerTurns, totalQuestions)} / {totalQuestions}
                </strong>
              </div>
            </div>
            <div className="interview-progress-bar">
              <div className="interview-progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </section>
        </aside>
      </main>

      <footer className="interview-footer">
        <div className="interview-footer-left">
          <button
            type="button"
            className="secondary-button"
            disabled={isCompleting}
            data-testid="interview-finish-button"
            onClick={() => {
              void finalize();
            }}
          >
            {isCompleting ? "Finishing..." : "End interview"}
          </button>
        </div>

        <div className="interview-answer-box">
          <textarea
            rows={3}
            value={answer}
            onChange={(event) => handleAnswerChange(event.target.value)}
            data-testid="interview-answer-input"
            placeholder="Answer with a short claim, your evidence, and the trade-off you chose."
          />
        </div>

        <div className="interview-footer-actions">
          <button type="button" className="secondary-button" disabled>
            Skip
          </button>
          <button
            type="button"
            className="primary-button"
            disabled={isStreaming || !answer.trim()}
            data-testid="interview-send-button"
            onClick={() => {
              void sendAnswer();
            }}
          >
            {isStreaming ? "Interviewer responding..." : "Submit answer"}
          </button>
        </div>
      </footer>
    </div>
  );
}
