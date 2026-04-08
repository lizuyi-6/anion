"use client";

import { useState } from "react";

import { createMobiusBrowserClient } from "@/lib/client/supabase";

type AuthTab = "login" | "register";

export function AuthPanel({
  supabaseUrl,
  supabaseAnonKey,
  appUrl,
}: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  appUrl: string;
}) {
  const [tab, setTab] = useState<AuthTab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [isPending, setIsPending] = useState(false);
  const supabase = createMobiusBrowserClient(supabaseUrl, supabaseAnonKey);

  const callbackUrl = `${appUrl}/auth/callback`;

  const showSuccess = (text: string) => {
    setMessage(text);
    setMessageType("success");
  };

  const showError = (err: unknown) => {
    setMessage(err instanceof Error ? err.message : "操作失败，请稍后重试。");
    setMessageType("error");
  };

  const onPasswordLogin = async () => {
    setIsPending(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      window.location.href = "/";
    } catch (error) {
      if (error instanceof Error && error.message.includes("Invalid login credentials")) {
        showError(new Error("邮箱或密码不正确"));
      } else if (error instanceof Error && error.message.includes("Email not confirmed")) {
        showError(new Error("请先验证邮箱，检查收件箱中的确认邮件"));
      } else {
        showError(error);
      }
    } finally {
      setIsPending(false);
    }
  };

  const onPasswordRegister = async () => {
    setIsPending(true);
    setMessage("");
    if (password.length < 6) {
      showError(new Error("密码至少需要 6 个字符"));
      setIsPending(false);
      return;
    }
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: displayName || undefined },
          emailRedirectTo: callbackUrl,
        },
      });
      if (error) throw error;
      showSuccess("注册成功！请检查邮箱完成验证，然后登录。");
      setTab("login");
      setPassword("");
    } catch (error) {
      if (error instanceof Error && error.message.includes("already registered")) {
        showError(new Error("该邮箱已注册，请直接登录或使用忘记密码"));
      } else {
        showError(error);
      }
    } finally {
      setIsPending(false);
    }
  };

  const onMagicLink = async () => {
    setIsPending(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: callbackUrl },
      });
      if (error) throw error;
      showSuccess("登录链接已发送到你的邮箱，请查收。");
    } catch (error) {
      showError(error);
    } finally {
      setIsPending(false);
    }
  };

  const onOAuth = async (provider: "google" | "github") => {
    setIsPending(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: callbackUrl },
      });
      if (error) throw error;
    } catch (error) {
      showError(error);
      setIsPending(false);
    }
  };

  const onResetPassword = async () => {
    if (!email) {
      showError(new Error("请先输入邮箱地址"));
      return;
    }
    setIsPending(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: callbackUrl,
      });
      if (error) throw error;
      showSuccess("密码重置邮件已发送，请查收。");
    } catch (error) {
      showError(error);
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "login") {
      void onPasswordLogin();
    } else {
      void onPasswordRegister();
    }
  };

  return (
    <div className="auth-panel-form stack-md">
      {/* Tabs */}
      <div className="auth-tabs">
        <button
          type="button"
          className={`auth-tab ${tab === "login" ? "active" : ""}`}
          onClick={() => { setTab("login"); setMessage(""); }}
        >
          登录
        </button>
        <button
          type="button"
          className={`auth-tab ${tab === "register" ? "active" : ""}`}
          onClick={() => { setTab("register"); setMessage(""); }}
        >
          注册
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="stack-sm">
        {tab === "register" && (
          <label className="field">
            <span>显示名称</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="你的名字（可选）"
              autoComplete="name"
            />
          </label>
        )}

        <label className="field">
          <span>邮箱</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            autoComplete="email"
          />
        </label>

        <label className="field">
          <span>密码</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={tab === "login" ? "输入密码" : "至少 6 个字符"}
            required
            minLength={6}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
          />
        </label>

        <button
          type="submit"
          className="primary-button"
          disabled={isPending || !email || !password}
        >
          {isPending
            ? "处理中..."
            : tab === "login"
              ? "登录"
              : "注册"}
        </button>

        {tab === "login" && (
          <button
            type="button"
            className="link-button"
            disabled={isPending}
            onClick={() => { void onResetPassword(); }}
          >
            忘记密码？
          </button>
        )}
      </form>

      {/* Divider */}
      <div className="auth-divider">
        <span>或</span>
      </div>

      {/* Magic Link */}
      <button
        type="button"
        className="secondary-button auth-magic-btn"
        disabled={isPending || !email}
        onClick={() => { void onMagicLink(); }}
      >
        通过邮箱链接登录
      </button>

      {/* OAuth */}
      <div className="auth-oauth-row">
        <button
          type="button"
          className="outline-button"
          disabled={isPending}
          onClick={() => { void onOAuth("google"); }}
        >
          Google
        </button>
        <button
          type="button"
          className="outline-button"
          disabled={isPending}
          onClick={() => { void onOAuth("github"); }}
        >
          GitHub
        </button>
      </div>

      {/* Status message */}
      {message ? (
        <p className={`auth-status-message ${messageType}`}>{message}</p>
      ) : null}
    </div>
  );
}
