"use client";

import { useState } from "react";

import { createMobiusBrowserClient } from "@/lib/client/supabase";

export function AuthPanel({
  supabaseUrl,
  supabaseAnonKey,
  appUrl,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
}) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isPending, setIsPending] = useState(false);
  const supabase = createMobiusBrowserClient(supabaseUrl, supabaseAnonKey);

  const onMagicLink = async () => {
    setIsPending(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${appUrl}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }

      setMessage("Magic link sent. Check your inbox.");
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
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${appUrl}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to start Google sign-in.");
      setIsPending(false);
    }
  };

  return (
    <section className="panel">
      <p className="panel-label">Authentication</p>
      <h3>Sign in to enable Supabase mode</h3>
      <p className="hero-copy">
        Use email magic link or Google. Demo mode remains available when Supabase is not configured.
      </p>
      <label className="field">
        <span>Email</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>
      <div className="action-row">
        <button
          type="button"
          className="primary-button"
          disabled={isPending || !email}
          onClick={() => {
            void onMagicLink();
          }}
        >
          {isPending ? "Sending..." : "Send Magic Link"}
        </button>
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
      </div>
      {message ? <p className="muted-copy">{message}</p> : null}
    </section>
  );
}
