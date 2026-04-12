"use client";

import { useState, useEffect } from "react";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  actionHref?: string;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [hasError, setHasError] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    let cancelled = false;
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setNotifications(data.notifications ?? []);
          setHasError(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[NOTIFICATIONS] Failed to fetch:", err);
          setHasError(true);
        }
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="notification-bell" style={{ position: "relative" }}>
      <button
        type="button"
        className="notification-toggle"
        onClick={() => setOpen(!open)}
        aria-label={`通知 (${unread})`}
      >
        {"\uD83D\uDD14"}{" "}
        {hasError ? (
          <span
            className="notification-badge"
            style={{ background: "#ef4444", cursor: "help" }}
            title="通知加载失败"
          >
            !
          </span>
        ) : unread > 0 ? (
          <span className="notification-badge">{unread}</span>
        ) : null}
      </button>
      {open && (
        <div className="notification-dropdown">
          {hasError ? (
            <div className="notification-item" style={{ color: "#ef4444" }}>
              <strong>通知加载失败</strong>
              <p>请稍后重试</p>
            </div>
          ) : notifications.length === 0 ? (
            <p className="muted-copy">暂无通知</p>
          ) : (
            notifications.slice(0, 5).map((n) => (
              <div key={n.id} className={`notification-item ${n.read ? "" : "unread"}`}>
                <strong>{n.title}</strong>
                <p>{n.body}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
