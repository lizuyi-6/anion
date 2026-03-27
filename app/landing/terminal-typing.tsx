"use client";

import { useState, useEffect } from "react";
import s from "./landing.module.css";

const fullText =
  "> System Context: Initialized.\n> Loading Interviewer Matrix...\n> [The Hacker] Online.\n> [The Architect] Online.\n> [The Founder] Online.\n> Warning: High pressure environment detected.\n> Awaiting candidate input_";

export function TerminalTyping() {
  const [text, setText] = useState("");

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setText(fullText.slice(0, index));
      index++;
      if (index > fullText.length) {
        clearInterval(interval);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={s.terminal}>
      <div className={s.terminalBar}>
        <div className={s.terminalDot} />
        <div className={s.terminalDot} />
        <div className={s.terminalDot} />
      </div>
      <div className={s.terminalBody}>
        {text}
        <span className={s.terminalCursor} />
      </div>
    </div>
  );
}
