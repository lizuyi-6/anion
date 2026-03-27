#!/usr/bin/env node

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { chromium } from "playwright";

const DEFAULT_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const DEFAULT_SLOW_MO = Number(process.env.PLAYWRIGHT_SLOW_MO ?? "0");

function createRunId() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseArgs(argv) {
  const options = {
    baseUrl: DEFAULT_BASE_URL,
    headed: false,
    slowMo: DEFAULT_SLOW_MO,
  };

  for (const arg of argv) {
    if (arg === "--headed") {
      options.headed = true;
      continue;
    }

    if (arg.startsWith("--base-url=")) {
      options.baseUrl = arg.slice("--base-url=".length);
      continue;
    }

    if (arg.startsWith("--slow-mo=")) {
      options.slowMo = Number(arg.slice("--slow-mo=".length));
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!Number.isFinite(options.slowMo) || options.slowMo < 0) {
    throw new Error(`Invalid --slow-mo value: ${options.slowMo}`);
  }

  return options;
}

function matchesApi(response, pathname, method) {
  const url = new URL(response.url());
  return url.pathname === pathname && response.request().method() === method;
}

function isSessionPath(url) {
  const segments = url.pathname.split("/").filter(Boolean);
  return segments.length === 2 && segments[0] === "simulator" && segments[1] !== "new";
}

async function ensureSuccessfulResponse(responsePromise) {
  const response = await responsePromise;
  await response.finished();

  if (!response.ok()) {
    let body = "";

    try {
      body = await response.text();
    } catch {
      body = "";
    }

    throw new Error(
      `Request failed: ${response.request().method()} ${response.url()} (${response.status()}) ${body}`.trim(),
    );
  }

  return response;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeText(filePath, lines) {
  const content = lines.length > 0 ? `${lines.join("\n")}\n` : "";
  await writeFile(filePath, content, "utf8");
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  const runId = createRunId();
  const artifactDir = path.resolve(process.cwd(), "output", "playwright", "anion-flow", runId);

  await mkdir(artifactDir, { recursive: true });

  const consoleMessages = [];
  const pageErrors = [];
  const requestFailures = [];
  const steps = [];

  let browser;
  let context;
  let page;
  let success = false;
  let sessionId = null;
  let rootCause = null;
  let shortestFix = [];

  const step = async (label, action) => {
    steps.push(label);
    console.log(`[step] ${label}`);
    await action();
  };

  const clickButton = async (testId) => {
    const button = page.getByTestId(testId);
    await button.scrollIntoViewIfNeeded();
    await button.click();
  };

  try {
    browser = await chromium.launch({
      headless: !options.headed,
      slowMo: options.slowMo,
    });

    context = await browser.newContext({
      viewport: { width: 1440, height: 1100 },
    });
    await context.tracing.start({
      screenshots: true,
      snapshots: true,
      sources: true,
    });

    page = await context.newPage();
    page.setDefaultTimeout(30_000);

    page.on("console", (message) => {
      consoleMessages.push(`[${message.type()}] ${message.text()}`);
    });
    page.on("pageerror", (error) => {
      pageErrors.push(error.stack ?? error.message);
    });
    page.on("requestfailed", (request) => {
      requestFailures.push(
        `${request.method()} ${request.url()} :: ${request.failure()?.errorText ?? "unknown"}`,
      );
    });

    await step("Open the interview setup", async () => {
      await page.goto(new URL("/simulator/new", options.baseUrl).toString(), {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      await page.getByTestId("interview-setup-form").waitFor({
        state: "visible",
        timeout: 60_000,
      });
    });

    await step("Fill the interview setup form", async () => {
      await page.getByTestId("target-company-input").fill("OpenAI");
      await page.getByTestId("industry-input").fill("AI");
      await page.getByTestId("level-input").fill("Senior");
      await page.getByTestId("candidate-name-input").fill("Abraham");
      await page
        .getByTestId("job-description-input")
        .fill(
          "Build reliable systems, defend architecture trade-offs under pressure, and explain the shortest safe fix for production issues.",
        );
    });

    await step("Create a new interview session", async () => {
      await page.getByTestId("create-session-button").scrollIntoViewIfNeeded();
      await Promise.all([
        ensureSuccessfulResponse(
          page.waitForResponse((response) => matchesApi(response, "/api/interviews", "POST"), {
            timeout: 60_000,
          }),
        ),
        page.waitForURL((url) => isSessionPath(url), { timeout: 60_000 }),
        page.getByTestId("create-session-button").click(),
      ]);

      const url = new URL(page.url());
      sessionId = url.pathname.split("/").at(-1) ?? null;

      if (!sessionId) {
        throw new Error(`Could not derive session id from ${page.url()}`);
      }
    });

    await step("Submit one interview answer", async () => {
      await page.getByTestId("interview-console").waitFor({
        state: "visible",
        timeout: 60_000,
      });
      await page
        .getByTestId("interview-answer-input")
        .fill(
          "I would protect the write boundary first, then add versioned writes so retries stay idempotent and the UI can refresh from a single source of truth.",
        );

      await Promise.all([
        ensureSuccessfulResponse(
          page.waitForResponse(
            (response) => matchesApi(response, `/api/interviews/${sessionId}/turn`, "POST"),
            { timeout: 60_000 },
          ),
        ),
        clickButton("interview-send-button"),
      ]);

      await page.getByTestId("transcript-row-candidate").last().waitFor({
        state: "visible",
        timeout: 60_000,
      });
      await page.getByTestId("transcript-row-interviewer").last().waitFor({
        state: "visible",
        timeout: 60_000,
      });
      await page.getByTestId("interview-streaming-indicator").waitFor({
        state: "hidden",
        timeout: 60_000,
      });
    });

    await step("Complete the interview and open the report", async () => {
      await Promise.all([
        ensureSuccessfulResponse(
          page.waitForResponse(
            (response) => matchesApi(response, `/api/interviews/${sessionId}/complete`, "POST"),
            { timeout: 60_000 },
          ),
        ),
        clickButton("interview-finish-button"),
      ]);

      await page.waitForURL((url) => url.pathname === `/report/${sessionId}`, {
        timeout: 60_000,
      });
    });

    await step("Wait for the final report", async () => {
      await page.getByTestId("accept-offer-button").waitFor({
        state: "visible",
        timeout: 120_000,
      });
      await page.screenshot({
        path: path.join(artifactDir, "report.png"),
        fullPage: true,
      });
    });

    await step("Accept the offer and enter the command center", async () => {
      await Promise.all([
        ensureSuccessfulResponse(
          page.waitForResponse(
            (response) => matchesApi(response, `/api/sessions/${sessionId}/accept`, "POST"),
            { timeout: 60_000 },
          ),
        ),
        ensureSuccessfulResponse(
          page.waitForResponse(
            (response) => matchesApi(response, `/api/sessions/${sessionId}/hub`, "POST"),
            { timeout: 60_000 },
          ),
        ),
        clickButton("accept-offer-button"),
      ]);

      await page.waitForURL(
        (url) => url.pathname === "/hub/copilot" && url.searchParams.get("session") === sessionId,
        {
          timeout: 60_000,
        },
      );
      await page.getByTestId("hub-console-copilot").waitFor({
        state: "visible",
        timeout: 60_000,
      });
    });

    await step("Run the copilot prompt", async () => {
      await page
        .getByTestId("hub-command-input")
        .fill(
          "A browser status toggle updates the server, but the UI stays stale until a hard refresh. Diagnose the likely root cause and give the shortest safe fix.",
        );

      await Promise.all([
        ensureSuccessfulResponse(
          page.waitForResponse(
            (response) => matchesApi(response, "/api/command/copilot", "POST"),
            { timeout: 60_000 },
          ),
        ),
        clickButton("hub-run-button"),
      ]);

      await page.getByTestId("copilot-output").waitFor({
        state: "visible",
        timeout: 60_000,
      });
      await page.getByTestId("copilot-root-cause").waitFor({
        state: "visible",
        timeout: 60_000,
      });
      await page.getByTestId("copilot-shortest-fix").waitFor({
        state: "visible",
        timeout: 60_000,
      });

      rootCause = (await page.getByTestId("copilot-root-cause").locator("p").textContent())?.trim() ?? null;
      shortestFix = (await page.getByTestId("copilot-shortest-fix").locator("li").allTextContents()).map(
        (item) => item.trim(),
      );

      await page.screenshot({
        path: path.join(artifactDir, "copilot.png"),
        fullPage: true,
      });
    });

    success = true;
    console.log(`[done] Session: ${sessionId}`);
    console.log(`[done] Artifacts: ${artifactDir}`);
  } catch (error) {
    if (page && !page.isClosed()) {
      await page.screenshot({
        path: path.join(artifactDir, "failure.png"),
        fullPage: true,
      }).catch(() => {});
    }

    throw error;
  } finally {
    if (context) {
      await context
        .tracing
        .stop({ path: path.join(artifactDir, "trace.zip") })
        .catch(() => {});
    }

    if (browser) {
      await browser.close().catch(() => {});
    }

    await Promise.all([
      writeText(path.join(artifactDir, "console.log"), consoleMessages),
      writeText(path.join(artifactDir, "page-errors.log"), pageErrors),
      writeText(path.join(artifactDir, "request-failures.log"), requestFailures),
      writeJson(path.join(artifactDir, "summary.json"), {
        success,
        baseUrl: options.baseUrl,
        sessionId,
        rootCause,
        shortestFix,
        steps,
      }),
    ]);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
