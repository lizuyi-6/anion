/**
 * Mobius 注册→登录→使用 全流程模拟
 *
 * 验证生产检查后的认证流程：
 *   首页 → 注册 → 登录 → Journey 页面 → 导航保持会话 → 健康检查
 *
 * 前置条件：
 *   pnpm playwright:install
 *   pnpm dev
 */

import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const SCREENSHOT_DIR = "output/playwright-screenshots";
const HEADED = process.argv.includes("--headed");

const TEST_EMAIL = `prod-audit-${Date.now()}@mobius.local`;
const TEST_PASSWORD = "TestAudit2026!";

async function probePort(port) {
  try {
    const res = await fetch(`http://localhost:${port}/`, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  let baseUrl;
  for (const port of [3001, 3000]) {
    if (await probePort(port)) {
      baseUrl = `http://localhost:${port}`;
      break;
    }
  }
  if (!baseUrl) {
    console.error("✗ 无法连接服务器。请先运行 pnpm dev");
    process.exit(1);
  }
  console.log(`✓ 服务器: ${baseUrl}`);

  await mkdir(SCREENSHOT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: !HEADED,
    slowMo: HEADED ? 200 : 50,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: "zh-CN",
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(30_000);

  const snap = async (name) => {
    const path = join(SCREENSHOT_DIR, `prod-audit-${name}.png`);
    await page.screenshot({ path, fullPage: true });
    console.log(`  📸 ${path}`);
  };

  const goto = (path) => page.goto(`${baseUrl}${path}`);

  const results = { register: false, login: false, session: false, health: false };

  try {
    // ─── Step 1: 首页 ──────────────────────────────────
    console.log("\n━━━ 步骤 1/7: 首页 ━━━");
    await goto("/");
    await page.waitForSelector(".public-shell", { timeout: 15_000 });
    await snap("01-home");
    console.log("  ✓ 首页加载成功");

    // ─── Step 2: 点击"开始准备" → 登录页 ────────────────
    console.log("\n━━━ 步骤 2/7: 进入登录页 ━━━");
    await page.click('a[href="/auth/sign-in"]');
    await page.waitForURL(/\/auth\/sign-in/, { timeout: 10_000 });
    await page.waitForSelector('[data-testid="auth-panel"], .auth-panel, form', { timeout: 10_000 });
    await snap("02-sign-in-page");
    console.log("  ✓ 登录页加载成功");

    // ─── Step 3: 注册新用户 ──────────────────────────────
    console.log("\n━━━ 步骤 3/7: 注册新用户 ━━━");
    console.log(`  邮箱: ${TEST_EMAIL}`);

    // Look for register tab/button
    const registerTab = page.locator('button, [role="tab"], a').filter({ hasText: /注册|注册账号|Register|Sign Up/ }).first();
    const hasRegisterTab = await registerTab.isVisible().catch(() => false);

    if (hasRegisterTab) {
      await registerTab.click();
      await page.waitForTimeout(500);
      console.log("  ✓ 切换到注册表单");
    }

    // Fill register form
    const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="邮箱"]').first();
    const passwordInput = page.locator('input[type="password"]').first();
    const passwordConfirm = page.locator('input[type="password"]').nth(1);

    await emailInput.fill(TEST_EMAIL);
    await passwordInput.fill(TEST_PASSWORD);
    if (await passwordConfirm.isVisible().catch(() => false)) {
      await passwordConfirm.fill(TEST_PASSWORD);
    }
    await snap("03-register-filled");

    // Submit register
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();
    await page.waitForTimeout(3000);
    await snap("04-register-result");

    // Check current URL for success/error indicators
    const afterRegisterUrl = page.url();
    console.log(`  当前 URL: ${afterRegisterUrl}`);

    if (afterRegisterUrl.includes("/journey") || afterRegisterUrl.includes("/simulator")) {
      results.register = true;
      results.login = true; // Auto-login after register
      console.log("  ✓ 注册成功，自动跳转");
    } else if (afterRegisterUrl.includes("error")) {
      console.log("  ⚠ 注册返回错误，尝试直接登录");
    } else {
      // Check for error message on page
      const errorText = await page.locator('.error, [role="alert"], .text-red').textContent().catch(() => "");
      console.log(`  页面状态: ${errorText || "无错误信息"}`);
    }

    // ─── Step 4: 如果未自动登录，手动登录 ────────────────
    if (!results.login) {
      console.log("\n━━━ 步骤 4/7: 手动登录 ━━━");
      // Make sure we're on sign-in page
      if (!page.url().includes("/auth/sign-in")) {
        await goto("/auth/sign-in");
        await page.waitForSelector('form', { timeout: 10_000 });
      }

      // Switch to login tab if needed
      const loginTab = page.locator('button, [role="tab"], a').filter({ hasText: /登录|登錄|Login|Sign In/ }).first();
      if (await loginTab.isVisible().catch(() => false)) {
        await loginTab.click();
        await page.waitForTimeout(500);
      }

      const loginEmail = page.locator('input[type="email"], input[name="email"], input[placeholder*="邮箱"]').first();
      const loginPassword = page.locator('input[type="password"]').first();
      await loginEmail.fill(TEST_EMAIL);
      await loginPassword.fill(TEST_PASSWORD);
      await snap("05-login-filled");

      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(3000);
      await snap("06-login-result");

      const afterLoginUrl = page.url();
      console.log(`  当前 URL: ${afterLoginUrl}`);

      if (afterLoginUrl.includes("/journey") || afterLoginUrl.includes("/simulator") || afterLoginUrl.includes("/hub")) {
        results.login = true;
        console.log("  ✓ 登录成功");
      } else {
        const errorText = await page.locator('.error, [role="alert"], .text-red').textContent().catch(() => "");
        console.log(`  ✗ 登录失败: ${errorText || "未知错误"}`);
      }
    } else {
      console.log("\n━━━ 步骤 4/7: 已自动登录，跳过 ━━━");
    }

    // ─── Step 5: 会话保持测试 ────────────────────────────
    if (results.login) {
      console.log("\n━━━ 步骤 5/7: 会话保持测试 ━━━");

      // Navigate to home page, then back to journey
      await goto("/");
      await page.waitForSelector(".public-shell", { timeout: 10_000 });
      await snap("07-home-logged-in");

      // Check if the home page shows "进入我的旅程" instead of "开始准备"
      const pageContent = await page.content();
      const hasEnterJourney = pageContent.includes("进入我的旅程");
      console.log(`  首页显示已登录状态: ${hasEnterJourney ? "是" : "否"}`);

      // Navigate back to journey
      await goto("/journey");
      await page.waitForTimeout(2000);
      await snap("08-journey-after-nav");

      const journeyUrl = page.url();
      if (journeyUrl.includes("/journey")) {
        results.session = true;
        console.log("  ✓ 会话保持成功：导航后仍在 /journey");
      } else if (journeyUrl.includes("/auth/sign-in")) {
        console.log("  ✗ 会话丢失：被重定向到登录页");
      } else {
        console.log(`  ? 导航后跳转到: ${journeyUrl}`);
      }
    }

    // ─── Step 6: 健康检查端点 ────────────────────────────
    console.log("\n━━━ 步骤 6/7: 健康检查端点 ━━━");
    const healthRes = await fetch(`${baseUrl}/api/health`);
    console.log(`  状态码: ${healthRes.status}`);
    if (healthRes.ok) {
      const healthData = await healthRes.json();
      console.log(`  响应: ${JSON.stringify(healthData)}`);
      results.health = healthData.status === "ok";
    } else {
      console.log(`  ✗ 健康检查失败: ${healthRes.status}`);
    }

    // ─── Step 7: 安全头检查 ──────────────────────────────
    console.log("\n━━━ 步骤 7/7: 安全头检查 ━━━");
    const homeRes = await fetch(`${baseUrl}/`);
    const securityHeaders = {
      "x-frame-options": homeRes.headers.get("x-frame-options"),
      "x-content-type-options": homeRes.headers.get("x-content-type-options"),
      "referrer-policy": homeRes.headers.get("referrer-policy"),
      "strict-transport-security": homeRes.headers.get("strict-transport-security"),
    };
    for (const [header, value] of Object.entries(securityHeaders)) {
      console.log(`  ${header}: ${value || "(未设置)"}`);
    }

    // ─── Report ────────────────────────────────────────
    console.log("\n═══════════════════════════════════════");
    console.log("  生产检查模拟结果");
    console.log("═══════════════════════════════════════");
    console.log(`  注册: ${results.register ? "✓ 通过" : "✗ 失败"}`);
    console.log(`  登录: ${results.login ? "✓ 通过" : "✗ 失败"}`);
    console.log(`  会话保持: ${results.session ? "✓ 通过" : "✗ 失败"}`);
    console.log(`  健康检查: ${results.health ? "✓ 通过" : "✗ 失败"}`);
    console.log(`  安全头:`);
    for (const [header, value] of Object.entries(securityHeaders)) {
      console.log(`    ${value ? "✓" : "✗"} ${header}: ${value || "未设置"}`);
    }
    console.log("═══════════════════════════════════════");

    const allPassed = results.register && results.login && results.session && results.health;
    process.exit(allPassed ? 0 : 1);

  } catch (error) {
    console.error("\n✗ 测试异常:", error.message);
    await snap("error").catch(() => {});
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
