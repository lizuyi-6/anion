"use client";

import { useState } from "react";

export function ReportActions() {
  const [copied, setCopied] = useState(false);

  const onPrint = () => {
    window.print();
  };

  const onShare = async () => {
    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: "Mobius diagnostic report",
          url,
        });
      } else {
        await navigator.clipboard.writeText(url);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="action-row">
      <button type="button" className="secondary-button" onClick={onPrint}>
        Print / PDF
      </button>
      <button type="button" className="primary-button" onClick={() => void onShare()}>
        {copied ? "Link copied" : "Share report"}
      </button>
    </div>
  );
}
