"use client";

import { useState, useRef } from "react";
import type {
  ActiveMemoryContext,
  CommandArtifact,
  CommandMode,
} from "@/lib/domain";
import { ArtifactRenderer } from "./artifact-renderer";
import { ChatInput } from "./chat-input";
import { detectCommandMode, inferModeFromContent, getSlashCommandList } from "./command-detector";
import { runCommandModeApi, sendChatMessage } from "@/lib/client/api";
import type { ChatResponse } from "@/lib/client/api";

interface CompanionChatProps {
  memoryContext: ActiveMemoryContext | null;
  initialMode?: CommandMode;
}

interface ChatBubble {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: CommandMode;
  artifact?: CommandArtifact;
  timestamp: number;
}

const modeLabels: Record<CommandMode, string> = {
  copilot: "副驾",
  strategy: "战略",
  sandbox: "沙盒",
};

const modeDescriptions: Record<CommandMode, string> = {
  copilot: "工程调试与问题分析",
  strategy: "可行性研究与计划生成",
  sandbox: "职场博弈与沟通模拟",
};

export function CompanionChat({ memoryContext, initialMode }: CompanionChatProps) {
  const [messages, setMessages] = useState<ChatBubble[]>([]);
  const [input, setInput] = useState("");
  const [threadId, setThreadId] = useState<string | undefined>();
  const [isRunning, setIsRunning] = useState(false);
  const [currentMode, setCurrentMode] = useState<CommandMode>(initialMode ?? "copilot");
  const [showWelcome, setShowWelcome] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const profile = memoryContext?.profile ?? null;

  const handleSend = async (text: string) => {
    if (!text.trim() || isRunning) return;

    setErrorMessage(null);
    setIsRunning(true);
    setShowWelcome(false);

    const userBubble: ChatBubble = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text.trim(),
      mode: currentMode,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userBubble]);
    setInput("");

    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);

    try {
      let result: ChatResponse;

      if (text.trim().startsWith("/")) {
        result = await sendChatMessage({
          threadId,
          message: text.trim(),
          mode: "auto",
        });
      } else {
        const { mode, cleanInput } = detectCommandMode(text.trim());
        const effectiveMode = mode === "auto" ? inferModeFromContent(cleanInput) : mode;

        result = await sendChatMessage({
          threadId,
          message: cleanInput,
          mode: effectiveMode,
        });
      }

      setThreadId(result.threadId);
      setCurrentMode(result.mode);

      const assistantBubble: ChatBubble = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: "",
        mode: result.mode,
        artifact: result.artifact,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantBubble]);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "请求失败");
    } finally {
      setIsRunning(false);
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  };

  const handleQuickAction = (mode: CommandMode) => {
    setCurrentMode(mode);
    setInput(`/${mode} `);
  };

  return (
    <div className="companion-chat" data-testid="companion-chat">
      <header className="companion-chat-header">
        <div>
          <h3>职业陪跑助手</h3>
          <p className="muted-copy">
            从面试准备到职场实战，用对话驱动一切。
          </p>
        </div>
        <div className="chip-row">
          {(getSlashCommandList()).map(({ command, mode, description }) => (
            <button
              key={command}
              type="button"
              className={`status-pill ${currentMode === mode ? "primary" : "subtle"}`}
              onClick={() => handleQuickAction(mode)}
            >
              {command} {description}
            </button>
          ))}
        </div>
      </header>

      {profile && (
        <div className="companion-memory-bar">
          <span className="panel-label">记忆图谱</span>
          <div className="chip-row">
            {profile.skills.slice(0, 3).map((item) => (
              <span key={item.label} className="status-pill subtle">
                {item.label} ({Math.round(item.confidence * 100)}%)
              </span>
            ))}
            {profile.gaps.slice(0, 3).map((item) => (
              <span key={item.label} className="status-pill warning">
                {item.label}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="companion-messages">
        {showWelcome && messages.length === 0 && (
          <div className="companion-welcome">
            <h4>你好，我是你的职业陪跑助手</h4>
            <p>
              你可以直接描述工作中遇到的问题，或者使用快捷命令：
            </p>
            <div className="chip-row">
              <span className="status-pill subtle">/copilot 工程调试</span>
              <span className="status-pill subtle">/strategy 研究报告</span>
              <span className="status-pill subtle">/sandbox 沟通模拟</span>
            </div>
            <p className="muted-copy">
              也可以直接输入问题，系统会自动判断你需要哪种帮助。
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <article
            key={msg.id}
            className={`chat-bubble ${msg.role}`}
          >
            <div className="chat-bubble-meta">
              <span>{msg.role === "user" ? "你" : "莫比乌斯"}</span>
              <span className="status-pill subtle">{modeLabels[msg.mode]}</span>
            </div>
            {msg.role === "assistant" && msg.artifact ? (
              <ArtifactRenderer artifact={msg.artifact} mode={msg.mode} />
            ) : (
              <p>{msg.content || "正在分析..."}</p>
            )}
          </article>
        ))}

        {isRunning && (
          <div className="chat-bubble assistant" data-testid="chat-thinking">
            <div className="chat-bubble-meta">
              <span>莫比乌斯</span>
              <span className="status-pill subtle">{modeLabels[currentMode]}</span>
            </div>
            <div className="breathing-light" style={{ margin: "0.5rem 0" }} />
            <span>正在分析...</span>
          </div>
        )}

        {errorMessage && (
          <div className="error-copy" data-testid="chat-error">{errorMessage}</div>
        )}

        <div ref={bottomRef} />
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={isRunning}
        onAttach={(files) => {
          // TODO: integrate with chat API attachments
        }}
      />

      <style>{`
        .companion-chat {
          display: flex;
          flex-direction: column;
          height: calc(100vh - 200px);
          min-height: 400px;
        }
        .companion-chat-header {
          padding: 1rem 1.5rem;
          border-bottom: 1px solid var(--line-subtle);
        }
        .companion-chat-header h3 {
          margin: 0;
          font-size: 1.1rem;
        }
        .companion-memory-bar {
          padding: 0.5rem 1.5rem;
          background: var(--surface-raised);
          border-bottom: 1px solid var(--line-subtle);
        }
        .companion-messages {
          flex: 1;
          overflow-y: auto;
          padding: 1rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .companion-welcome {
          padding: 2rem;
          text-align: center;
          color: var(--muted);
        }
        .companion-welcome h4 {
          color: var(--fg);
          margin-bottom: 0.75rem;
        }
        .chat-bubble {
          padding: 0.75rem 1rem;
          border-radius: 8px;
          max-width: 85%;
        }
        .chat-bubble.user {
          align-self: flex-end;
          background: var(--accent-soft);
          border: 1px solid var(--accent);
        }
        .chat-bubble.assistant {
          align-self: flex-start;
          background: var(--surface-raised);
          border: 1px solid var(--line-subtle);
        }
        .chat-bubble-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 0.5rem;
          font-size: 0.8rem;
          color: var(--muted);
        }
        .status-pill.primary {
          background: var(--accent);
          color: white;
        }
      `}</style>
    </div>
  );
}
