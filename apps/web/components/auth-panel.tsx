"use client";

import { useState } from "react";

export function AuthPanel({
  authDriver,
}: {
  authDriver: "local" | "supabase";
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);

  const onMagicLink = async () => {
    setIsPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/auth/magic-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          next: "/",
        }),
      });
      const payload = (await response.json().catch(() => null)) as { message?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.message ?? "Unable to send magic link");
      }

      setMessage(
        authDriver === "local"
          ? "Local auth is active. Continue in demo mode."
          : "Magic link sent. Check your inbox.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send magic link.");
    } finally {
      setIsPending(false);
    }
  };

  const onGoogle = async () => {
    setIsPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/v1/auth/google", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          next: "/",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { url?: string; message?: string }
        | null;
      if (!response.ok || !payload?.url) {
        throw new Error(payload?.message ?? "Unable to start Google sign-in");
      }

      window.location.assign(payload.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start Google sign-in.");
      setIsPending(false);
    }
  };

  return (
    <section className="panel">
      <p className="panel-label">Identity</p>
      <h3>Sign in to open the workspace</h3>
      <p className="hero-copy">
        Authentication now runs through the API service. In local mode, the demo viewer stays
        available without an external provider.
      </p>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
        />
      </label>
      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          disabled={isPending || (!email && authDriver !== "local")}
          onClick={() => {
            void onMagicLink();
          }}
        >
          {isPending
            ? "Sending..."
            : authDriver === "local"
              ? "Continue in demo mode"
              : "Send magic link"}
        </button>
        {authDriver === "supabase" ? (
          <button
            type="button"
            className="secondary-button"
            disabled={isPending}
            onClick={() => {
              void onGoogle();
            }}
          >
            Continue with Google
          </button>
        ) : null}
      </div>
      {message ? <p className="muted-copy">{message}</p> : null}
    </section>
  );
}
