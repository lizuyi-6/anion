/**
 * Mobius 用户手册截图脚本
 *
 * 对每个用户界面页面截取全页截图，用于生成带图用户手册。
 *
 * 前置条件：
 *   pnpm playwright:install
 *   pnpm dev
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const DIR = "output/manual-screenshots";
const HEADED = process.argv.includes("--headed");

async function probePort(port) {
  try { const r = await fetch(`http://localhost:${port}/`, { method: "HEAD" }); return r.ok; } catch { return false; }
}

async function main() {
  let baseUrl;
  for (const port of [3001, 3000]) {
    if (await probePort(port)) { baseUrl = `http://localhost:${port}`; break; }
  }
  if (!baseUrl) { console.error("✗ 请先运行 pnpm dev"); process.exit(1); }
  console.log(`✓ 服务器: ${baseUrl}`);

  await mkdir(DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !HEADED, slowMo: HEADED ? 100 : 0 });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-CN" });
  const page = await ctx.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(60_000);

  const snap = async (name) => {
    const path = join(DIR, `${name}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(`  📸 ${path}`);
  };
  const goto = (p) => page.goto(`${baseUrl}${p}`);

  try {
    // 1. 首页
    console.log("\n━━━ 1/9: 首页 ━━━");
    await goto("/");
    await page.waitForSelector(".public-shell", { timeout: 15_000 });
    await snap("01-landing");

    // 2. 登录页
    console.log("\n━━━ 2/9: 登录/注册页 ━━━");
    await goto("/auth/sign-in");
    await page.waitForSelector("form", { timeout: 10_000 });
    await snap("02-sign-in");

    // Switch to register tab
    const regTab = page.locator('button, [role="tab"]').filter({ hasText: /注册/ }).first();
    if (await regTab.isVisible().catch(() => false)) {
      await regTab.click();
      await page.waitForTimeout(500);
      await snap("02b-register");
    }

    // 3. 进入演示模式 → Journey 页
    console.log("\n━━━ 3/9: Journey 仪表盘 (演示模式) ━━━");
    // Click demo button
    const demoBtn = page.locator('a, button').filter({ hasText: /进入演示/ }).first();
    if (await demoBtn.isVisible().catch(() => false)) {
      await demoBtn.click();
    } else {
      await goto("/journey");
    }
    await page.waitForURL(/\/(journey|hub)/, { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await snap("03-journey");

    // 4. 目标设定页
    console.log("\n━━━ 4/9: 目标设定 (三步向导) ━━━");
    await goto("/simulator/new");
    await page.waitForSelector('[data-testid="interview-setup-form"], .wizard-track', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await snap("04-setup-step1");

    // Fill step 1
    const company = page.locator('[data-testid="target-company-input"], input[name="targetCompany"]').first();
    if (await company.isVisible().catch(() => false)) {
      await company.fill("字节跳动");
      const industry = page.locator('[data-testid="industry-input"], input[name="industry"]').first();
      await industry.fill("AI Infra");
      const level = page.locator('[data-testid="level-input"], select').first();
      await level.selectOption("资深").catch(() => {});
      const name_ = page.locator('[data-testid="candidate-name-input"], input[placeholder*="候选人"]').first();
      await name_.fill("张三");
      const jd = page.locator('[data-testid="job-description-input"], textarea').first();
      await jd.fill("负责大规模分布式训练平台的架构设计与性能优化，需要在高压技术面试中准确表达架构取舍和工程判断能力。");
      await snap("04b-setup-step1-filled");

      // Advance to step 2
      const nextBtn = page.locator(".wizard-nav-row button, button").filter({ hasText: /下一步/ }).first();
      await nextBtn.click().catch(() => {});
      await page.waitForTimeout(1000);
      await snap("04c-setup-step2-materials");

      // Advance to step 3
      const nextBtn2 = page.locator(".wizard-nav-row button, button").filter({ hasText: /下一步/ }).first();
      await nextBtn2.click().catch(() => {});
      await page.waitForTimeout(1000);
      await snap("04d-setup-step3-focus");

      // Fill focus goal
      const focusGoal = page.locator('[data-testid="focus-goal-input"], textarea').first();
      if (await focusGoal.isVisible().catch(() => false)) {
        await focusGoal.fill("被打断后仍能在60秒内给出结论和证据");
      }

      // Create session
      const createBtn = page.locator('[data-testid="create-session-button"], button').filter({ hasText: /进入模拟/ }).first();
      await createBtn.click().catch(() => {});
      await page.waitForURL(/\/simulator\/[^/]+$/, { timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(2000);

      // 5. 模拟训练页
      console.log("\n━━━ 5/9: 模拟训练 ━━━");
      await snap("05-simulator-init");

      // Wait for first interviewer question and take another screenshot
      await page.waitForTimeout(5000);
      await snap("05b-simulator-question");

      // 6. Submit a brief answer to get more content
      const answerField = page.locator('textarea, [contenteditable]').first();
      if (await answerField.isVisible().catch(() => false)) {
        await answerField.fill("我的核心判断是：在分布式训练场景下，首先需要守住梯度同步的接口边界，再用版本化写入保证弱网重试的一致性。");
        const sendBtn = page.locator('button').filter({ hasText: /发送/ }).first();
        await sendBtn.click().catch(() => {});
        await page.waitForTimeout(8000);
        await snap("05c-simulator-turn1");

        // Answer round 2
        const answerField2 = page.locator('textarea, [contenteditable]').first();
        if (await answerField2.isVisible().catch(() => false)) {
          await answerField2.fill("这个取舍的核心在于一致性延迟与可用性的平衡。我选择在关键路径上用同步屏障，非关键路径用最终一致性。");
          const sendBtn2 = page.locator('button').filter({ hasText: /发送/ }).first();
          await sendBtn2.click().catch(() => {});
          await page.waitForTimeout(8000);
          await snap("05d-simulator-turn2");
        }
      }

      // End the session
      const endBtn = page.locator('button').filter({ hasText: /结束本轮/ }).first();
      if (await endBtn.isVisible().catch(() => false)) {
        await endBtn.click();
        await page.waitForTimeout(3000);
        await snap("05e-simulator-ended");

        // Wait for redirect to report
        await page.waitForURL(/\/report\//, { timeout: 30_000 }).catch(() => {});
      }
    }

    // 7. 复盘报告页
    console.log("\n━━━ 6/9: 复盘报告 ━━━");
    if (page.url().includes("/report/")) {
      await page.waitForTimeout(5000);
      await snap("06-report");
    } else {
      // Try to navigate to a report page
      await snap("06-report-status");
    }

    // 8. Hub 工作台
    console.log("\n━━━ 7/9: 工作台 ━━━");
    await goto("/hub");
    await page.waitForTimeout(2000);
    await snap("07-hub");

    // 9. Workshop 设计系统
    console.log("\n━━━ 8/9: Workshop (可选) ━━━");
    await goto("/workshop");
    await page.waitForTimeout(1000);
    await snap("08-workshop");

    // 10. Journey 页 (如果已有会话记录)
    console.log("\n━━━ 9/9: Journey (有记录) ━━━");
    await goto("/journey");
    await page.waitForTimeout(2000);
    await snap("09-journey-with-session");

    console.log("\n✓ 截图完成！");
  } catch (error) {
    console.error("\n✗ 错误:", error.message);
    await snap("error").catch(() => {});
  } finally {
    await browser.close();
  }
}

main();
