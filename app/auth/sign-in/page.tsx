import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth-panel";
import { PublicShell } from "@/components/public-shell";
import { hasSupabase, runtimeEnv } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";

export default async function SignInPage() {
  const viewer = await getViewer();

  if (viewer && !viewer.isDemo) {
    redirect("/journey");
  }

  const authConfigured = hasSupabase();

  return (
    <PublicShell
      viewer={viewer}
      actions={
        <Link href="/#journey" className="public-link-button secondary">
          了解更多
        </Link>
      }
    >
      <section className="auth-entry-grid">
        <div className="auth-entry-copy">
          <span className="landing-kicker">开始你的准备旅程</span>
          <h1>选择一种方式进入</h1>
          <p>
            演示模式无需登录，适合快速了解流程。注册账号后，所有模拟记录、
            分析报告和工作台数据都会持久保存。
          </p>

          <div className="auth-stage-list">
            <div className="auth-stage-item">
              <strong>演示模式</strong>
              <span>无需登录，直接体验完整流程。</span>
            </div>
            <div className="auth-stage-item">
              <strong>邮箱注册</strong>
              <span>支持密码登录、Magic Link、Google 和 GitHub OAuth。</span>
            </div>
            <div className="auth-stage-item">
              <strong>开始第一轮</strong>
              <span>选择目标岗位和压力等级，系统自动编排面试。</span>
            </div>
          </div>
        </div>

        <div className="auth-entry-stack">
          <article className="auth-entry-card">
            <span className="panel-label">快速体验</span>
            <h2>演示模式</h2>
            <p className="muted-copy">
              不需要账号，直接感受完整的面试模拟和分析流程。
            </p>
            <Link href="/journey" className="primary-button">
              进入演示
            </Link>
          </article>

          <article className="auth-entry-card">
            <span className="panel-label">登录 / 注册</span>
            <h2>建立个人空间</h2>
            {authConfigured ? (
              <AuthPanel
                supabaseUrl={runtimeEnv.supabaseBrowserUrl ?? ""}
                supabaseAnonKey={runtimeEnv.supabaseAnonKey ?? ""}
                appUrl={runtimeEnv.appUrl}
              />
            ) : (
              <div className="auth-disabled-note">
                <p className="muted-copy">
                  当前环境未连接 Supabase，暂不支持真实登录。
                </p>
                <p className="muted-copy">
                  请先用演示模式体验，接入账号系统后即可保存长期记录。
                </p>
              </div>
            )}
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
