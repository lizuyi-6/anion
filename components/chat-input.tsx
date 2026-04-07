"use client";

import { useState, useRef } from "react";

import type { CommandMode } from "@/lib/domain";
import { getSlashCommandList } from "./command-detector";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  onAttach?: (files: FileList | null) => void;
}

export function ChatInput({ onSend, disabled, onAttach }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const commands = getSlashCommandList();

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (input.trim()) {
        onSend(input.trim());
        setInput("");
      }
    }
  };

  const handleCommandSelect = (mode: CommandMode) => {
    setInput(`/${mode} `);
    setShowCommands(false);
    inputRef.current?.focus();
  };

  return (
    <div className="chat-input-bar">
      <div className="chat-input-wrapper">
        <textarea
          ref={inputRef}
          rows={1}
          className="chat-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (input === "/") {
              setShowCommands(true);
            }
          }}
          placeholder="输入问题，或使用 /copilot /strategy /sandbox 切换模式..."
          disabled={disabled}
          data-testid="chat-input"
        />
        {showCommands && (
          <div className="slash-dropdown" data-testid="slash-dropdown">
            {commands.map((cmd) => (
              <button
                key={cmd.command}
                type="button"
                className="slash-command-option"
                onClick={() => handleCommandSelect(cmd.mode)}
              >
                <strong>{cmd.command}</strong>
                <span>{cmd.description}</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          className="primary-button chat-send-button"
          disabled={disabled || !input.trim()}
          onClick={() => {
            if (input.trim()) {
              onSend(input.trim());
              setInput("");
            }
          }}
          data-testid="chat-send-button"
        >
          {disabled ? "思考中..." : "发送"}
        </button>
      </div>
      {onAttach && (
        <label className="chat-attach-button">
          <span>+</span>
          <input
            type="file"
            multiple
            onChange={(event) => {
              onAttach(event.target.files);
            }}
          />
        </label>
      )}
    </div>
  );
}
