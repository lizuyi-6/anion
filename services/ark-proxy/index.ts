/**
 * ARK API Proxy Service
 *
 * A proxy that converts OpenAI structured output requests to ARK API format.
 * Injects JSON examples into system prompts to enforce schema compliance.
 */

import { createServer } from "http";
import { parse } from "url";
import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: resolve(__dirname, ".env") });

const PORT = parseInt(process.env.PROXY_PORT || "18792", 10);
const ARK_API_KEY = process.env.ARK_API_KEY || "";
const ARK_BASE_URL = process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/coding/v1";
const ARK_MODEL = process.env.ARK_MODEL || "ark-code-latest";

// JSON schema examples for each command mode
const SCHEMA_EXAMPLES: Record<string, { keywords: string[]; example: string }> = {
  copilot: {
    keywords: ["rootCause", "shortestFix", "copilot", "debug", "fix", "bug", "root_cause",
      "根因", "修复", "排查", "调试", "副驾", "工程副驾", "optionalRefactors", "memoryAnchor",
      "techForesight", "watchouts", "refactor"],
    example: JSON.stringify({
      rootCause: "string - root cause analysis",
      shortestFix: ["step1", "step2"],
      optionalRefactors: ["refactor1"],
      memoryAnchor: "string - anchor to memory",
      watchouts: ["warning1", "warning2"],
      techForesight: [{ technology: "name", risk: "high", timeline: "3 months", recommendation: "action" }],
    }),
  },
  strategy: {
    keywords: ["strategy", "feasibility", "market", "roadmap", "plan", "sections", "diagramSpec",
      "timelineSpec", "successMetrics", "assumptions", "openQuestions", "deliverables",
      "战略", "可行性", "市场", "计划", "排期", "资源", "路线图"],
    example: JSON.stringify({
      sections: [{ id: "market", title: "title", body: "content" }],
      citations: [],
      diagramSpec: { nodes: [{ id: "n1", label: "label", lane: 0 }], edges: [{ from: "n1", to: "n2", label: "label" }] },
      timelineSpec: { items: [{ phase: "phase", startWeek: 1, durationWeeks: 2, owner: "owner" }] },
      risks: ["risk1"],
      deliverables: ["deliverable1"],
      successMetrics: ["metric1"],
      assumptions: ["assumption1"],
      openQuestions: ["question1"],
    }),
  },
  sandbox: {
    keywords: ["counterpart", "equilibrium", "payoff", "negotiation", "pressure",
      "counterpartModel", "recommendedMove", "longTermCost", "talkTracks", "scenarioBranches",
      "博弈", "谈判", "对手", "施压", "沙盒", "职场", "均衡"],
    example: JSON.stringify({
      counterpartModel: { style: "style description", incentives: ["inc1"], redLines: ["line1"] },
      equilibrium: "equilibrium description",
      recommendedMove: "recommended action",
      longTermCost: "cost description",
      pressurePoints: ["point1"],
      talkTracks: ["track1"],
      scenarioBranches: [{ name: "branch", ifYouPush: "result", ifYouConcede: "result", signalToWatch: "signal" }],
      payoffMatrix: { rowHeader: "You", colHeader: "Opponent", rows: [{ label: "action", payoffs: ["a", "b"] }], nashEquilibrium: "description" },
    }),
  },
  sandboxTurn: {
    keywords: ["counterpartMessage", "counterpartTone", "strategicCommentary", "pressureLevel",
      "对手的口吻", "战术分析", "策略意图"],
    example: JSON.stringify({
      counterpartMessage: "message from counterpart",
      counterpartTone: "tone description",
      strategicCommentary: "strategic analysis",
      pressureLevel: 5,
    }),
  },
  liveTurn: {
    keywords: ["speakerId", "speakerLabel", "pressureDelta", "面试指挥官", "结构化事件",
      "follow_up", "interrupt", "conflict"],
    example: JSON.stringify({
      id: "event_id",
      kind: "follow_up",
      speakerId: "hacker",
      speakerLabel: "Hacker",
      pressureDelta: 4,
      message: "interviewer question",
      rationale: "reasoning",
      timestamp: "2026-01-01T00:00:00Z",
    }),
  },
};

function detectSchema(messages: { role: string; content: string }[]): string | null {
  const allText = messages.map((m) => m.content).join(" ").toLowerCase();
  let bestMatch: string | null = null;
  let bestScore = 0;
  for (const [name, { keywords }] of Object.entries(SCHEMA_EXAMPLES)) {
    const score = keywords.filter((kw) => allText.includes(kw.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      bestMatch = name;
    }
  }
  return bestScore >= 1 ? bestMatch : null;
}

function buildSystemPrompt(originalSystem: string, schemaName: string | null): string {
  let prompt = originalSystem;

  if (schemaName && SCHEMA_EXAMPLES[schemaName]) {
    const example = SCHEMA_EXAMPLES[schemaName].example;
    prompt += `\n\nYou MUST return JSON that exactly matches this structure:\n${example}\n\nUse the EXACT field names shown above. Do not rename or restructure fields. Fill in realistic values based on context. Output ONLY valid JSON.`;
  } else {
    prompt += `\n\nYou MUST return ONLY valid JSON. No markdown, no explanation, no text before or after the JSON.`;
  }

  return prompt;
}

interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: { type: string; schema?: unknown };
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

async function callArkApi(messages: ChatCompletionMessage[]): Promise<string> {
  const response = await fetch(`${ARK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ARK_API_KEY}`,
    },
    body: JSON.stringify({ model: ARK_MODEL, messages, stream: false }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ARK API error: ${response.status} ${error}`);
  }

  const data = (await response.json()) as ChatCompletionResponse;
  return data.choices[0]?.message?.content || "";
}

function extractJson(content: string): string {
  const trimmed = content.trim();

  // Direct JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let depth = 0;
    const open = trimmed[0];
    const close = open === "{" ? "}" : "]";
    let inStr = false;
    let esc = false;
    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === "\\") { esc = true; continue; }
        if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') { inStr = true; continue; }
      if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) return trimmed.substring(0, i + 1);
      }
    }
    return trimmed;
  }

  // Markdown code block
  const cb = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (cb) return cb[1].trim();

  // Embedded JSON
  const m = trimmed.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return m ? m[1] : trimmed;
}

const server = createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const parsedUrl = parse(req.url || "", true);
  if (req.method !== "POST" || parsedUrl.pathname !== "/v1/chat/completions") {
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not found" }));
    return;
  }

  try {
    const body = await new Promise<string>((resolve, reject) => {
      let data = "";
      req.on("data", (chunk) => (data += chunk));
      req.on("end", () => resolve(data));
      req.on("error", reject);
    });

    const request = JSON.parse(body) as ChatCompletionRequest;
    if (!request.messages?.length) {
      res.writeHead(400);
      res.end(JSON.stringify({ error: "Invalid messages" }));
      return;
    }

    // Detect schema and build enhanced system prompt
    const schemaName = detectSchema(request.messages);
    const originalSystem = request.messages.find((m) => m.role === "system")?.content || "";
    const enhancedSystem = buildSystemPrompt(originalSystem, schemaName);

    // Build ARK messages: replace system prompt, keep rest
    const arkMessages: ChatCompletionMessage[] = [
      { role: "system", content: enhancedSystem },
      ...request.messages.filter((m) => m.role !== "system"),
    ];

    console.log(`[PROXY] schema=${schemaName || "none"} messages=${arkMessages.length}`);

    const content = await callArkApi(arkMessages);
    const extractedJson = extractJson(content);

    // Validate JSON
    let validatedJson: string;
    try {
      JSON.parse(extractedJson);
      validatedJson = extractedJson;
    } catch {
      console.error("[PROXY] Invalid JSON, returning raw:", extractedJson.slice(0, 200));
      validatedJson = extractedJson;
    }

    const response: ChatCompletionResponse = {
      id: `ark-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: ARK_MODEL,
      choices: [{ index: 0, message: { role: "assistant", content: validatedJson }, finish_reason: "stop" }],
      usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(response));
  } catch (error) {
    console.error("[PROXY] Error:", error);
    res.writeHead(500);
    res.end(JSON.stringify({ error: "Internal proxy error", message: error instanceof Error ? error.message : String(error) }));
  }
});

server.listen(PORT, () => {
  console.log(`ARK API Proxy listening on port ${PORT}`);
  console.log(`Forwarding to: ${ARK_BASE_URL}`);
  console.log(`Using model: ${ARK_MODEL}`);
});
