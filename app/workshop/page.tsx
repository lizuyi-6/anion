"use client";

import { useMemo, useState } from "react";
import { buildRadarAxisLabels, buildRadarPolygon } from "@/lib/visuals/renderers";
import styles from "./page.module.css";

type ThemeId = "aurora" | "linear" | "frosted" | "warm" | "paper";

const themes: Array<{ id: ThemeId; label: string; sub: string }> = [
  { id: "paper", label: "Paper", sub: "纸面" },
  { id: "linear", label: "Linear", sub: "极简" },
  { id: "aurora", label: "Aurora", sub: "极光" },
  { id: "frosted", label: "Frosted", sub: "毛玻璃" },
  { id: "warm", label: "Warm", sub: "暖调" },
];

const radarScores = [
  { label: "架构深度", score: 82 },
  { label: "系统设计", score: 68 },
  { label: "业务判断", score: 75 },
  { label: "落地执行", score: 90 },
  { label: "压力应对", score: 58 },
  { label: "团队协作", score: 85 },
];

const palettes: Record<ThemeId, Array<{ color: string; label: string }>> = {
  aurora: [
    { color: "#09090b", label: "bg" },
    { color: "#818cf8", label: "accent" },
    { color: "#34d399", label: "secondary" },
    { color: "#e4e4e7", label: "text" },
    { color: "#f472b6", label: "danger" },
    { color: "#fbbf24", label: "warning" },
  ],
  linear: [
    { color: "#09090b", label: "bg" },
    { color: "#5e6ad2", label: "accent" },
    { color: "#4c9a8a", label: "secondary" },
    { color: "#e4e4e7", label: "text" },
    { color: "#e5534b", label: "danger" },
    { color: "#d29922", label: "warning" },
  ],
  frosted: [
    { color: "#f0f2f5", label: "bg" },
    { color: "#6366f1", label: "accent" },
    { color: "#0ea5e9", label: "secondary" },
    { color: "#1e1b4b", label: "text" },
    { color: "#ef4444", label: "danger" },
    { color: "#f59e0b", label: "warning" },
  ],
  warm: [
    { color: "#0c0a09", label: "bg" },
    { color: "#c49a6c", label: "accent" },
    { color: "#a8886a", label: "secondary" },
    { color: "#e8e0d4", label: "text" },
    { color: "#d4726a", label: "danger" },
    { color: "#d4a04a", label: "warning" },
  ],
  paper: [
    { color: "#fafafa", label: "bg" },
    { color: "#1a1a1a", label: "accent" },
    { color: "#555555", label: "secondary" },
    { color: "#1a1a1a", label: "text" },
    { color: "#c0392b", label: "danger" },
    { color: "#b8860b", label: "warning" },
  ],
};

function MiniRadar() {
  const polygon = useMemo(() => buildRadarPolygon(radarScores, 80), []);
  const axes = useMemo(() => buildRadarAxisLabels(radarScores, 96), []);

  return (
    <svg viewBox="-110 -110 220 220" width="220" height="220">
      {/* Rings */}
      {[20, 40, 60, 80].map((r) => (
        <circle
          key={r}
          cx="0"
          cy="0"
          r={r}
          fill="none"
          stroke="var(--ws-chart-ring)"
          strokeWidth="1"
        />
      ))}
      {/* Axis lines */}
      {axes.map((a, i) => (
        <line
          key={i}
          x1="0"
          y1="0"
          x2={a.x}
          y2={a.y}
          stroke="var(--ws-chart-ring)"
          strokeWidth="1"
        />
      ))}
      {/* Data polygon */}
      <polygon
        points={polygon}
        fill="var(--ws-chart-fill)"
        stroke="var(--ws-chart-stroke)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      {/* Labels */}
      {axes.map((a, i) => (
        <text
          key={i}
          x={a.x}
          y={a.y}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="var(--ws-chart-label)"
          fontSize="9"
          fontFamily="inherit"
        >
          {a.label}
        </text>
      ))}
    </svg>
  );
}

export default function WorkshopPage() {
  const [active, setActive] = useState<ThemeId>("paper");
  const swatches = palettes[active];

  return (
    <div className={`${styles.workshop} ${styles[`theme-${active}`]}`}>
      <div className={styles.workshopInner}>
        {/* Header */}
        <header className={styles.header}>
          <h1 className={styles.title}>设计风格 Workshop</h1>
          <p className={styles.subtitle}>
            同一套组件，五种视觉语言
          </p>
        </header>

        {/* Tabs */}
        <div className={styles.tabBar}>
          {themes.map((t) => (
            <button
              key={t.id}
              className={`${styles.tab} ${active === t.id ? styles.tabActive : ""}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}{" "}
              <span style={{ opacity: 0.5, marginLeft: 4 }}>{t.sub}</span>
            </button>
          ))}
        </div>

        {/* Color Palette */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>调色板</h2>
          <div className={styles.paletteGrid}>
            {swatches.map((s) => (
              <div key={s.label} className={styles.paletteSwatch}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    borderRadius: 9,
                    background: s.color,
                  }}
                />
                <span className={styles.paletteSwatchLabel}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Cards */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>功能卡片</h2>
          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 2v4M10 14v4M2 10h4M14 10h4M4.93 4.93l2.83 2.83M12.24 12.24l2.83 2.83M15.07 4.93l-2.83 2.83M7.76 12.24l-2.83 2.83" />
                </svg>
              </div>
              <h3 className={styles.featureCardTitle}>面试模拟器</h3>
              <p className={styles.featureCardDesc}>
                多面试官高压模拟，实时信号分析，逐轮压力递增
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 15l3-3 3 3 3-4 5 2" />
                  <circle cx="4" cy="4" r="1.5" />
                </svg>
              </div>
              <h3 className={styles.featureCardTitle}>诊断报告</h3>
              <p className={styles.featureCardDesc}>
                八维能力雷达图，STAR 故事提取，记忆画像构建
              </p>
            </div>
            <div className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="16" height="14" rx="2" />
                  <path d="M2 7h16" />
                  <path d="M7 7v10" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              </div>
              <h3 className={styles.featureCardTitle}>指挥中心</h3>
              <p className={styles.featureCardDesc}>
                工程副驾、战略工作台、职场博弈沙盒
              </p>
            </div>
          </div>
        </section>

        {/* Form + Buttons */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>表单与按钮</h2>
          <div className={styles.formSample}>
            <div className={styles.formGrid}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>目标公司</label>
                <input
                  className={styles.fieldInput}
                  defaultValue="OpenAI"
                  readOnly
                />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>岗位级别</label>
                <input
                  className={styles.fieldInput}
                  defaultValue="Senior"
                  readOnly
                />
              </div>
              <div className={`${styles.field} ${styles.fieldFull}`}>
                <label className={styles.fieldLabel}>职位描述</label>
                <textarea
                  className={styles.fieldTextarea}
                  defaultValue="Build reliable systems, defend architecture trade-offs under pressure."
                  readOnly
                />
              </div>
            </div>
            <div className={styles.buttonRow}>
              <button className={styles.btnPrimary}>进入面试模拟器</button>
              <button className={styles.btnSecondary}>保存草稿</button>
              <button className={styles.btnDanger}>删除</button>
            </div>
          </div>
        </section>

        {/* Two Column: Radar + Status */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>数据可视化与状态</h2>
          <div className={styles.twoCol}>
            {/* Radar Chart */}
            <div className={styles.chartCard}>
              <div className={styles.chartGrid}>
                <MiniRadar />
                <div className={styles.metricGrid}>
                  {radarScores.slice(0, 4).map((s) => (
                    <div key={s.label} className={styles.metricItem}>
                      <div className={styles.metricScore}>{s.score}</div>
                      <div className={styles.metricLabel}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Chat + Status */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Status Pills */}
              <div>
                <p
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 500,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ws-text-label)",
                    margin: "0 0 10px",
                    fontFamily: '"IBM Plex Mono", monospace',
                  }}
                >
                  状态标签
                </p>
                <div className={styles.pillRow}>
                  <span className={`${styles.pill} ${styles.pillActive}`}>
                    <span className={styles.pillDot} />
                    面试中
                  </span>
                  <span className={`${styles.pill} ${styles.pillDone}`}>
                    <span className={styles.pillDot} />
                    报告就绪
                  </span>
                  <span className={`${styles.pill} ${styles.pillWarn}`}>
                    <span className={styles.pillDot} />
                    分析中
                  </span>
                  <span className={`${styles.pill} ${styles.pillError}`}>
                    <span className={styles.pillDot} />
                    失败
                  </span>
                </div>
              </div>

              {/* Chat Transcript */}
              <div className={styles.chatSample}>
                <div className={styles.chatMeta}>架构师 · 追问</div>
                <div className={`${styles.chatBubble} ${styles.chatBubbleInterviewer}`}>
                  你提到版本化写入来保证幂等性，但具体用什么机制来检测冲突？如果两个请求同时写同一条记录怎么办？
                </div>
                <div className={styles.chatMeta}>你 · 回答</div>
                <div className={`${styles.chatBubble} ${styles.chatBubbleCandidate}`}>
                  我会使用乐观锁加上条件更新，在写入时带上版本号，服务端校验版本一致性，冲突时返回
                  409 让客户端决定重试策略。
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
