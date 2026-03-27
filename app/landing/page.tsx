import Link from "next/link";
import styles from "./landing.module.css";

export default function LandingPage() {
  return (
    <div className={styles.container}>
      <div className={styles.bgGradient}>
        <div className={styles.bgGradientTop} />
        <div className={styles.bgGradientAccent} />
        <div className={styles.bgGradientBottom} />
      </div>
      <div className={styles.bgGrid} />
      <div className={`${styles.bgOrb} ${styles.bgOrb1}`} />
      <div className={`${styles.bgOrb} ${styles.bgOrb2}`} />
      <div className={`${styles.bgOrb} ${styles.bgOrb3}`} />
      <div className={`${styles.bgOrb} ${styles.bgOrb4}`} />
      <div className={`${styles.bgOrb} ${styles.bgOrb5}`} />

      <header className={styles.header}>
        <div className={styles.logo}>
          <span className={styles.logoIcon}>M</span>
          <span className={styles.logoText}>Mobius</span>
        </div>
        <Link href="/auth/sign-in" className={styles.headerLink}>
          登录
        </Link>
      </header>

      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>莫比乌斯计划</p>
          <h1 className={styles.title}>
            从高压面试<br />到职场制胜
          </h1>
          <p className={styles.subtitle}>
            AI 驱动的面试模拟器，配备非线性追问、群面冲突<br className={styles.desktopOnly} />
            与可沉淀成能力图谱的终局报告。
          </p>
          <div className={styles.heroCta}>
            <Link href="/simulator/new" className={styles.primaryButton}>
              开始模拟面试
            </Link>
            <Link href="/hub/copilot" className={styles.secondaryButton}>
              探索指挥中心
            </Link>
          </div>
        </section>

        <section className={styles.features}>
          <div className={styles.featureCard}>
            <p className={styles.featureLabel}>A / 面试模拟器</p>
            <h2 className={styles.featureTitle}>千面考官沙盒</h2>
            <p className={styles.featureDesc}>
              支持非线性追问、群面冲突、规则优先的打断机制，以及可沉淀成能力图谱的终局报告。
            </p>
            <Link href="/simulator/new" className={styles.cardLink}>
              创建会话 →
            </Link>
          </div>

          <div className={styles.featureCard}>
            <p className={styles.featureLabel}>B / 指挥中心</p>
            <h2 className={styles.featureTitle}>工程 / 战略 / 沙盒</h2>
            <p className={styles.featureDesc}>
              工程副驾、可行性研究生成器和职场博弈沙盘，共享同一份长期记忆图谱。
            </p>
            <Link href="/hub/copilot" className={styles.cardLink}>
              进入指挥中心 →
            </Link>
          </div>

          <div className={styles.featureCard}>
            <p className={styles.featureLabel}>C / 终局报告</p>
            <h2 className={styles.featureTitle}>记忆重构系统</h2>
            <p className={styles.featureDesc}>
              当报告确认后，把冷启动考场切换成高科技中枢，系统目标从"找漏洞"改为"补短板并赢下战役"。
            </p>
            <Link href="/report/demo" className={styles.cardLink}>
              查看示例报告 →
            </Link>
          </div>
        </section>

        <section className={styles.stats}>
          <div className={styles.statItem}>
            <strong className={styles.statNumber}>3</strong>
            <span className={styles.statLabel}>核心工作台</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <strong className={styles.statNumber}>AI</strong>
            <span className={styles.statLabel}>智能面试官</span>
          </div>
          <div className={styles.statDivider} />
          <div className={styles.statItem}>
            <strong className={styles.statNumber}>∞</strong>
            <span className={styles.statLabel}>能力图谱</span>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <p className={styles.footerText}>
          莫比乌斯计划 · 面试模拟器 · Powered by AI
        </p>
        <Link href="/simulator/new" className={styles.footerCta}>
          立即体验 →
        </Link>
      </footer>
    </div>
  );
}
