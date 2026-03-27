import Link from "next/link";
import {
  Terminal,
  Layers,
  Briefcase,
  Code,
  FileText,
  Crosshair,
  Activity,
  Network,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { TerminalTyping } from "./terminal-typing";
import s from "./landing.module.css";

function FeatureCard({
  icon: Icon,
  title,
  desc,
  tags,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  desc: string;
  tags?: string[];
}) {
  return (
    <div className={s.featureCard}>
      <Icon className={s.cardIcon} strokeWidth={1.5} />
      <h3 className={s.cardTitle}>{title}</h3>
      <p className={s.cardDesc}>{desc}</p>
      {tags && (
        <div className={s.cardTags}>
          {tags.map((tag) => (
            <span key={tag} className={s.cardTag}>
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className={s.container}>
      {/* Background */}
      <div className={s.bgGradient}>
        <div className={s.bgGradientCenter} />
        <div className={s.bgGradientBottom} />
      </div>
      <div className={s.bgGrid} />

      {/* Header */}
      <header className={s.header}>
        <div className={s.logo}>
          <ShieldCheck className={s.logoIcon} />
          MÖBIUS
        </div>
        <nav className={s.navLinks}>
          <a href="#sandbox">千面考官</a>
          <a href="#singularity">奇点时刻</a>
          <a href="#copilot">职场外脑</a>
        </nav>
        <Link href="/auth/sign-in" className={s.headerButton}>
          Request Access
        </Link>
      </header>

      {/* Hero */}
      <section className={s.hero}>
        <h1 className={s.heroTitle}>
          极致压迫诊断
          <br />
          <span className={s.heroTitleAccent}>全栈智能赋能</span>
        </h1>
        <p className={s.heroSubtitle}>
          告别机械式问答。Möbius
          融合动态多轮博弈引擎，从深挖技术漏洞的"严苛考官"，无缝转化为补齐你能力短板的"专属职场外脑"。
        </p>
        <TerminalTyping />
      </section>

      {/* Module A */}
      <section id="sandbox" className={s.moduleSection}>
        <p className={s.moduleLabel}>MODULE A</p>
        <h2 className={s.moduleTitle}>
          千面考官沙盒{" "}
          <span className={s.moduleTitleLight}>| The Interview Simulator</span>
        </h2>
        <p className={s.moduleDesc}>
          非线性对话树与动态压力机制。AI
          像闻到血腥味的鲨鱼一样深挖你的逻辑漏洞，并在多
          Agent 冲突中考察你的博弈能力。
        </p>
        <div className={s.cardGrid}>
          <FeatureCard
            icon={Terminal}
            title="The Hacker"
            desc="技术狂人。极度关注底层逻辑，要求手写算法题，针对 C 语言指针越界、内存泄漏或高并发瓶颈进行连环追问。"
            tags={["底层逻辑", "算法批改", "压力打断"]}
          />
          <FeatureCard
            icon={Layers}
            title="The Architect"
            desc="系统架构师。关注系统全貌。给定模糊业务场景，要求从零设计软硬结合架构，深究数据流转逻辑。"
            tags={["全局设计", "软硬协同", "边界推演"]}
          />
          <FeatureCard
            icon={Briefcase}
            title="The Founder"
            desc="创始人/CEO。极度关注商业直觉与人性。抛出道德困境与商业博弈问题，考察价值观与决策模型的契合度。"
            tags={["商业博弈", "价值观诊断", "纳什均衡"]}
          />
        </div>
      </section>

      {/* Module B — Singularity */}
      <section id="singularity" className={s.singularitySection}>
        <div className={s.singularityGrid} />
        <div className={s.singularityContent}>
          <p className={s.moduleLabel}>MODULE B</p>
          <h2 className={s.moduleTitle}>
            奇点时刻{" "}
            <span className={s.moduleTitleLight}>| State Transition</span>
          </h2>
          <p className={s.singularityPoem}>
            数据图谱提纯完毕。
            <br />
            System Prompt 覆写执行中...
            <br />
            考场色调褪去，中枢控制台亮起。
          </p>
          <div className={s.ctaGroup}>
            <Link href="/simulator/new" className={s.ctaButton}>
              Accept Offer
              <ArrowRight className={s.ctaArrow} />
            </Link>
            <p className={s.ctaHint}>
              &gt; 目标变更：从"找出漏洞"切换为"补齐短板"
            </p>
          </div>
        </div>
      </section>

      {/* Module C */}
      <section id="copilot" className={s.moduleSection}>
        <p className={s.moduleLabel}>MODULE C</p>
        <h2 className={s.moduleTitle}>
          专属职场外脑{" "}
          <span className={s.moduleTitleLight}>| The Command Center</span>
        </h2>
        <p className={s.moduleDesc}>
          一个完全了解你技术短板和性格特征的个人中枢。基于实体能力图谱，提供一针见血的执行辅助与战略推演。
        </p>
        <div className={s.cardGrid}>
          <FeatureCard
            icon={Code}
            title="全栈与架构副驾"
            desc='遇 Bug 直接抛入。它已熟知你的技术栈水平，省略废话，直接指出类似"上次面试中暴露的悬垂指针"问题并重构。'
            tags={["精准排错", "前瞻性推演", "架构建议"]}
          />
          <FeatureCard
            icon={FileText}
            title="可行性与战略生成"
            desc="输入模糊指令，自动调用内置商业模型框架，输出结构严谨、排版极简的 PRD 或可行性研究报告 (FSR)。"
            tags={["结构化输出", "商业模型", "自动化排期"]}
          />
          <FeatureCard
            icon={Crosshair}
            title="职场博弈沙盘"
            desc="设定对手性格参数进行预演。利用囚徒困境等博弈论模型分析局势，帮你寻找人际冲突与资源抢夺中的纳什均衡点。"
            tags={["A2A对抗模拟", "利益均衡", "谈判策略"]}
          />
        </div>
      </section>

      {/* Diagnostics */}
      <section className={s.moduleSection}>
        <div className={s.diagGrid}>
          <div className={s.diagLeft}>
            <h2 className={s.diagTitle}>终局透视与反向重构</h2>
            <ul className={s.diagList}>
              <li className={s.diagItem}>
                <Activity className={s.diagItemIcon} />
                <div>
                  <p className={s.diagItemTitle}>高维度雷达图</p>
                  <p className={s.diagItemDesc}>
                    弃用简单的"通过/不通过"，输出包含技术深度、工程直觉、沟通效率等多维度的矢量级能力报告。
                  </p>
                </div>
              </li>
              <li className={s.diagItem}>
                <Network className={s.diagItemIcon} />
                <div>
                  <p className={s.diagItemTitle}>数据图谱提纯</p>
                  <p className={s.diagItemDesc}>
                    后台静默执行脱水处理，建立专属实体标签库：[性格：倾向规避冲突]，[架构：偏好微服务]。
                  </p>
                </div>
              </li>
              <li className={s.diagItem}>
                <FileText className={s.diagItemIcon} />
                <div>
                  <p className={s.diagItemTitle}>反向简历重构</p>
                  <p className={s.diagItemDesc}>
                    提取高压逼问下的"高光时刻"，自动生成极具杀伤力的
                    STAR 原则项目描述。
                  </p>
                </div>
              </li>
            </ul>
          </div>
          <div className={s.diagRight}>
            <div className={s.codeBlock}>
              <div className={s.codeInner}>
                <div className={s.codeGlow} />
                <div className={s.codeHeader}>
                  <div className={s.codeDot} />
                  RAW_MEMORY_DUMP
                </div>
                <pre className={s.codePre}>{`{
  "entity": "candidate_01",
  "traits": {
    "c_lang": "pointer_mastery",
    "architecture": "microservices_biased",
    "conflict_resolution": "avoidant"
  },
  "bottlenecks": [
    "distributed_locks",
    "negotiation_assertiveness"
  ]
}`}</pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={s.footer}>
        <div className={s.footerLogo}>
          <ShieldCheck className={s.logoIcon} />
          MÖBIUS
        </div>
        <p className={s.footerTagline}>
          从能力诊断到定向补齐，闭环赋能平台。
        </p>
        <div className={s.footerLinks}>
          <Link href="#">Privacy</Link>
          <Link href="#">Terms</Link>
          <Link href="#">Architecture</Link>
        </div>
      </footer>
    </div>
  );
}
