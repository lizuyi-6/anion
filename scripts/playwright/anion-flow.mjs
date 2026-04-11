/**
 * Mobius 全流程浏览器自动化测试
 *
 * 使用 Playwright 模拟用户点击操作，覆盖完整的用户旅程：
 *   首页 → 面试设置 → 模拟训练 → 复盘报告 → 工作台
 *
 * 前置条件：
 *   pnpm playwright:install    # 首次安装 chromium
 *   pnpm dev                    # 启动服务器
 *
 * 运行方式：
 *   pnpm playwright:flow        # 无头模式
 *   pnpm playwright:flow:headed # 有头模式（可视化）
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

// ─── Config ───────────────────────────────────────────────

const SCREENSHOT_DIR = "output/playwright-screenshots";

const CANDIDATE_ANSWERS = [
  "我的核心判断是：在分布式训练场景下，首先需要守住梯度同步的接口边界，再用版本化写入保证弱网重试的一致性。这是因为最先失控的是写路径的并发和回滚成本。",
  "这个取舍的核心在于：一致性延迟 vs 可用性。我选择在关键路径上用同步屏障，非关键路径用最终一致性。代价是增加了关键路径的 P99 延迟大约 200ms，但换来的是数据完整性的可验证性。",
  "如果这个决策失败了，回滚方案是在 30 秒内切换到只读降级模式。这个决策仍然值得赌，因为当前瓶颈已经在写路径上，不改的话系统在下一个季度会直接扛不住峰值。",
];

const HEADED = process.argv.includes("--headed");

// ─── Helpers ──────────────────────────────────────────────

async function probePort(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

// ─── Main ─────────────────────────────────────────────────

async function main() {
  // Resolve base URL
  let baseUrl;
  for (const port of [3001, 3000]) {
    if (await probePort(port)) {
      baseUrl = `http://localhost:${port}`;
      break;
    }
  }
  if (!baseUrl) {
    console.error("✗ 无法连接服务器。请先运行 pnpm dev 或 pnpm start:playwright");
    process.exit(1);
  }
  console.log(`✓ 服务器: ${baseUrl}`);

  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: HEADED ? 100 : 0,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(120_000);

  page.on("console", (msg) => {
    if (msg.type() === "error") console.log(`  [browser] ${msg.text()}`);
  });

  const snap = async (index, name) => {
    const path = join(SCREENSHOT_DIR, `${String(index).padStart(2, "0")}-${name}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(`  📸 ${path}`);
  };

  const goto = (path) => page.goto(`${baseUrl}${path}`);

  try {
    // ─── Step 1: Landing Page ──────────────────────
    console.log("\n━━━ 步骤 1/5: 落地页 ━━━");
    await goto("/");
    await page.waitForSelector(".public-shell", { timeout: 15_000 });
    await snap(1, "landing");

    // Navigate directly to setup
    await goto("/simulator/new");
    await page.waitForSelector('[data-testid="interview-setup-form"]', { timeout: 10_000 });
    console.log("  ✓ 已进入面试设置页");

    // ─── Step 2: Interview Setup (3-step wizard) ────
    console.log("\n━━━ 步骤 2/5: 面试设置 ━━━");

    // Wizard Step 0: Target info
    console.log("  [向导 1/3] 目标岗位...");
    await page.fill('[data-testid="target-company-input"]', "字节跳动");
    await page.fill('[data-testid="industry-input"]', "AI Infra");
    await page.selectOption('[data-testid="level-input"]', "资深");
    await page.fill('[data-testid="candidate-name-input"]', "测试候选人");
    await page.fill(
      '[data-testid="job-description-input"]',
      "负责大规模分布式训练平台的架构设计与性能优化，需要在高压技术面试中准确表达架构取舍和工程判断。",
    );
    await snap(2, "setup-target");

    // Advance to step 1
    await page.locator(".wizard-nav-row").getByText("下一步").click();
    await page.getByText("第二步").waitFor();

    // Wizard Step 1: Materials (skip)
    console.log("  [向导 2/3] 跳过材料上传...");
    await snap(3, "setup-materials");

    // Advance to step 2
    await page.locator(".wizard-nav-row").getByText("下一步").click();
    await page.waitForSelector('[data-testid="focus-goal-input"]', { timeout: 5000 });

    // Wizard Step 2: Focus goal + role pack (defaults kept)
    console.log("  [向导 3/3] 压测目标...");
    await page.fill('[data-testid="focus-goal-input"]', "被打断后仍能在60秒内给出结论和证据");
    await snap(4, "setup-focus");

    // Submit → navigate to /simulator/[sessionId]
    console.log("  → 创建会话...");
    await page.click('[data-testid="create-session-button"]');
    await page.waitForURL(/\/simulator\/[^/]+$/, { timeout: 15_000 });
    await page.waitForSelector('[data-testid="interview-console"]', { timeout: 10_000 });
    console.log("  ✓ 面试会话已创建");

    // ─── Step 3: Interview Console ──────────────────
    console.log("\n━━━ 步骤 3/5: 模拟训练 ━━━");
    await snap(5, "interview-init");

    for (let i = 0; i < CANDIDATE_ANSWERS.length; i++) {
      const round = i + 1;
      console.log(`  [轮次 ${round}/${CANDIDATE_ANSWERS.length}]`);

      await page.fill('[data-testid="interview-answer-input"]', CANDIDATE_ANSWERS[i]);

      const before = await page.locator('[data-testid="transcript-row-interviewer"]').count();
      await page.click('[data-testid="interview-send-button"]');

      // Wait for at least one new interviewer row (AI responded)
      await page.waitForFunction(
        (n) => document.querySelectorAll('[data-testid="transcript-row-interviewer"]').length > n,
        before,
        { timeout: 60_000 },
      );
      await page.waitForTimeout(300);
      await snap(5 + i, `interview-round-${round}`);
      console.log(`  ✓ 第 ${round} 轮完成`);
    }

    // Finish interview → analysis runs inline, may be slow with real AI
    // Extract sessionId from current URL, then navigate to report page
    console.log("  → 结束面试...");
    const simulatorUrl = page.url();
    const sessionId = simulatorUrl.match(/\/simulator\/([^/]+)$/)?.[1];
    await page.click('[data-testid="interview-finish-button"]');

    // Wait briefly for the complete API call to start, then navigate to report
    // The report page has ReportStatusPanel that polls for analysis completion
    await page.waitForTimeout(2000);
    await goto(`/report/${sessionId}`);
    console.log("  ✓ 已跳转到报告页");

    // ─── Step 4: Report ─────────────────────────────
    console.log("\n━━━ 步骤 4/5: 复盘报告 ━━━");

    // Wait for report to be ready, retry if analysis fails
    console.log("  ⏳ 等待报告生成...");
    const reportDeadline = Date.now() + 240_000;
    let reportReady = false;
    while (!reportReady && Date.now() < reportDeadline) {
      try {
        await page.waitForSelector('[data-testid="accept-offer-button"]', {
          state: "visible",
          timeout: 60_000,
        });
        reportReady = true;
      } catch {
        // Check if analysis failed — click retry button
        const retryBtn = page.locator('[data-testid="report-status-panel"] button');
        if (await retryBtn.count() > 0) {
          console.log("  ↻ 分析失败，重试...");
          await retryBtn.click();
          await page.waitForTimeout(3000);
        }
      }
    }
    if (!reportReady) throw new Error("报告生成超时");
    await snap(9, "report");
    console.log("  ✓ 报告已加载");

    // Accept → triggers overlay, then navigates to /hub
    console.log("  → 接受报告...");
    await page.click('[data-testid="accept-offer-button"]');
    await page.waitForURL(/\/hub/, { timeout: 15_000 });
    console.log("  ✓ 已进入工作台");

    // ─── Step 5: Hub Workspace ──────────────────────
    console.log("\n━━━ 步骤 5/5: 工作台聊天 ━━━");
    await page.waitForSelector('[data-testid="companion-chat"]', { timeout: 10_000 });
    await snap(10, "hub");

    console.log("  → 发送消息...");
    const assistantBefore = await page.locator("article.chat-bubble.assistant").count();
    await page.fill('[data-testid="chat-input"]', "线上出现一个状态切换后 UI 不刷新的 bug，帮我定位根因");
    await page.click('[data-testid="chat-send-button"]');

    // Wait for assistant reply (article, not the thinking div)
    await page.waitForFunction(
      (n) => document.querySelectorAll("article.chat-bubble.assistant").length > n,
      assistantBefore,
      { timeout: 60_000 },
    );
    console.log("  ✓ 收到助手回复");
    await snap(11, "hub-chat");

    console.log("\n✅ 全流程测试通过！");
  } catch (error) {
    console.error(`\n❌ 测试失败: ${error.message}`);
    await page
      .screenshot({ path: join(SCREENSHOT_DIR, "error-final.png"), fullPage: true })
      .catch(() => {});
    process.exitCode = 1;
  } finally {
    if (HEADED) {
      console.log("\n有头模式：3 秒后关闭浏览器...");
      await new Promise((r) => setTimeout(r, 3000));
    }
    await browser.close();
  }
}

main();
