import Link from "next/link";
import { redirect } from "next/navigation";

import { AuthPanel } from "@/components/auth-panel";
import { PublicShell } from "@/components/public-shell";
import { hasSupabase, runtimeEnv } from "@/lib/env";
import { getViewer } from "@/lib/server/auth";

export default async function SignInPage() {
  const viewer = await getViewer();

  if (viewer && !viewer.isDemo) {
    redirect("/");
  }

  const authConfigured = hasSupabase();

  return (
    <PublicShell
      viewer={viewer}
      actions={
        <Link href="/landing#journey" className="public-link-button secondary">
          查看陪跑方式
        </Link>
      }
    >
      <section className="auth-entry-grid">
        <div className="auth-entry-copy">
          <span className="landing-kicker">开始进入你的准备旅程</span>
          <h1>先选一种开始方式，不用先理解整套系统。</h1>
          <p>
            如果你只是想快速体验，就先走演示模式；如果已经接入登录能力，就直接创建自己的长期记录。
          </p>

          <div className="auth-stage-list">
            <div className="auth-stage-item">
              <strong>1. 继续体验演示</strong>
              <span>先看完整条流程：目标、模拟、复盘、行动计划。</span>
            </div>
            <div className="auth-stage-item">
              <strong>2. 登录 / 注册</strong>
              <span>把历史记录、复盘和行动计划绑定到自己的长期空间里。</span>
            </div>
            <div className="auth-stage-item">
              <strong>3. 开始第一轮准备</strong>
              <span>先说清楚目标岗位和已有材料，后续页面会自动接力。</span>
            </div>
          </div>
        </div>

        <div className="auth-entry-stack">
          <article className="auth-entry-card">
            <span className="panel-label">演示模式</span>
            <h2>先走一遍完整流程</h2>
            <p className="muted-copy">
              适合第一次进入产品时快速理解体验，不需要先配置账号系统。
            </p>
            <Link href="/" className="primary-button">
              继续体验演示
            </Link>
          </article>

          <article className="auth-entry-card">
            <span className="panel-label">登录 / 注册</span>
            <h2>建立自己的长期陪跑空间</h2>
            {authConfigured ? (
              <AuthPanel
                supabaseUrl={runtimeEnv.supabaseUrl ?? ""}
                supabaseAnonKey={runtimeEnv.supabaseAnonKey ?? ""}
                appUrl={runtimeEnv.appUrl}
              />
            ) : (
              <div className="auth-disabled-note">
                <p className="muted-copy">
                  当前环境还没有连接 Supabase，所以这里先不展示真实登录。
                </p>
                <p className="muted-copy">
                  现在建议先用演示模式熟悉流程，等接入账号系统后再保存长期记录。
                </p>
              </div>
            )}
          </article>
        </div>
      </section>
    </PublicShell>
  );
}
