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
      setMessage(error instanceof Error ? error.message : "无法发送魔法链接。");
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
      <p className="panel-label">身份验证</p>
      <h3>登录以启用Supabase模式</h3>
      <p className="hero-copy">
        使用邮箱魔法链接或Google登录。当Supabase未配置时，演示模式仍然可用。
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
          disabled={isPending || !email}
          onClick={() => {
            void onMagicLink();
          }}
        >
          {isPending ? "发送中..." : "发送魔法链接"}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={isPending}
          onClick={() => {
            void onGoogle();
          }}
        >
          继续使用Google登录
        </button>
      </div>
      {message ? <p className="muted-copy">{message}</p> : null}
    </section>
  );
}
