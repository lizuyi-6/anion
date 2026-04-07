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
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((data) => setNotifications(data.notifications ?? []))
      .catch(() => {});
  }, []);

  return (
    <div className="notification-bell" style={{ position: "relative" }}>
      <button
        type="button"
        className="notification-toggle"
        onClick={() => setOpen(!open)}
        aria-label={`通知 (${unread})`}
      >
        {"\uD83D\uDD14"} {unread > 0 && <span className="notification-badge">{unread}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          {notifications.length === 0 ? (
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
