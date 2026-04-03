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

      setMessage("Magic link 已发送，请检查你的邮箱。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法发送 magic link。");
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
      setMessage(error instanceof Error ? error.message : "无法启动 Google 登录。");
      setIsPending(false);
    }
  };

  return (
    <div className="auth-panel-form stack-md">
      <div>
        <p className="panel-label">登录方式</p>
        <h3>登录后可以长期保存你的准备记录</h3>
        <p className="hero-copy">
          可以先用邮箱 magic link，也可以直接使用 Google 登录。完成登录后，后续模拟、
          复盘和行动计划都会绑定到你的个人空间里。
        </p>
      </div>
      <label className="field">
        <span>邮箱</span>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="your@email.com"
        />
      </label>
      <div className="auth-panel-actions">
        <button
          type="button"
          className="primary-button"
          disabled={isPending || !email}
          onClick={() => {
            void onMagicLink();
          }}
        >
          {isPending ? "发送中..." : "发送 magic link"}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={isPending}
          onClick={() => {
            void onGoogle();
          }}
        >
          使用 Google 登录
        </button>
      </div>
      {message ? <p className="muted-copy auth-status-message">{message}</p> : null}
    </div>
  );
}
