/**
 * Semantic signal analysis using embedding-based similarity.
 *
 * Architecture:
 * - Seed vectors are pre-computed once per process lifetime (module-level cache)
 * - Answer embedding is computed per-answer in generateNextInterviewBeat
 * - cosineSimilarity is computed synchronously on the CPU
 * - If embeddings are unavailable (mock mode, init failure), silently falls back
 *   to pure keyword-only analysis
 *
 * NOTE: This module intentionally does NOT import AiProviderAdapter from
 * @anion/infrastructure to preserve the application layer's dependency rules.
 * Instead, it uses a local EmbeddingsProvider interface.
 */

import type { SignalDimension } from "./interview-director";

// Local interface — mirrors the generateEmbeddings capability needed by this module.
// This allows the module to work without importing from infrastructure.
export type EmbeddingsProvider = {
  generateEmbeddings?(input: string[]): Promise<number[][] | null>;
};

// Each dimension's seed phrase is a multilingual representative text
// that captures the semantic space of that signal dimension.
const SEED_PHRASES: Record<SignalDimension, string> = {
  low_level:
    "algorithm complexity memory pointer malloc free thread mutex lock cache concurrent race condition 动态规划 图论 指针 内存 并发 锁 复杂度",
  architecture:
    "system architecture service gateway queue latency network distributed API fallback degradation 架构 系统 服务 网关 队列 延迟 分布式 降级",
  business:
    "revenue margin budget customer market pricing ROI GMV cost business value commercial 用户 市场 收入 预算 成本 商业 价值",
  tradeoff:
    "trade-off sacrifice cut choice priority compromise between A and B 权衡 取舍 优先级 放弃 折中",
  metrics:
    "metric KPI SLA SLO latency throughput conversion retention indicator measurement 指标 转化 留存 吞吐",
  ownership:
    "owner ownership decision accountability interface contract responsible 负责 拍板 控制权 归属 接口",
  people:
    "team manager stakeholder feedback conflict collaboration communication people leadership 团队 同事 反馈 冲突 领导",
  process:
    "runbook incident handoff rollout rollback SOP process procedure playbook 流程 预案 交接 回滚 上线",
  data: "event sample query dataset experiment log instrumentation 埋点 样本 实验 数据集 日志",
  risk: "risk failure downtime incident edge case worst case contingency mitigation 风险 故障 失败 边界",
};

export type SemanticScores = Partial<Record<SignalDimension, number>>;

// Module-level cache — survives across all interview beats in a process lifetime
let _cache: Map<SignalDimension, number[]> | null = null;
let _provider: EmbeddingsProvider | null = null;

/**
 * Initialize the semantic cache with a provider that has generateEmbeddings.
 * Call this once before any semantic analysis.
 */
export function initSemanticCache(provider: EmbeddingsProvider): void {
  _provider = provider;
  _cache = new Map();
}

/** Returns true if the cache has been warmed with seed vectors. */
export function isSemanticCacheReady(): boolean {
  return _cache !== null && _provider !== null && _cache.size > 0;
}

/**
 * Warm the cache by generating embeddings for all seed phrases.
 * Idempotent — safe to call multiple times.
 */
export async function warmSeedVectors(): Promise<void> {
  if (!_provider || !_cache) {
    console.warn(
      "[signal-semantics] Cache not initialized. Call initSemanticCache first.",
    );
    return;
  }

  const dims = Object.keys(SEED_PHRASES) as SignalDimension[];
  const phrases = dims.map((d) => SEED_PHRASES[d]);

  const embeddings = await _provider.generateEmbeddings?.(phrases);
  if (!embeddings) {
    console.warn(
      "[signal-semantics] Embedding generation returned null. Semantic scoring disabled.",
    );
    return;
  }

  dims.forEach((dim, i) => {
    _cache!.set(dim, embeddings[i]);
  });
}

/** Get the cached seed vector for a dimension. Returns null if not warmed. */
export function getSeedVector(dim: SignalDimension): number[] | null {
  return _cache?.get(dim) ?? null;
}

/**
 * Generate embedding for a single text.
 * Returns null if provider is not set or generateEmbeddings is unavailable.
 */
export async function getAnswerEmbedding(
  text: string,
): Promise<number[] | null> {
  if (!_provider) return null;
  const result = await _provider.generateEmbeddings?.([text]);
  return result?.[0] ?? null;
}

/**
 * Compute cosine similarity between two vectors.
 * Returns 0 if either vector is zero or if lengths mismatch.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Compute semantic similarity scores for each signal dimension.
 * Each dimension gets a score [0, 1] representing cosine similarity
 * between the answer embedding and the dimension's seed vector.
 *
 * @param answerEmbedding - Pre-computed embedding of the candidate's answer
 * @param dims - Which dimensions to score (defaults to all)
 */
export function computeSemanticScores(
  answerEmbedding: number[],
  dims: SignalDimension[] = Object.keys(SEED_PHRASES) as SignalDimension[],
): SemanticScores {
  const scores: SemanticScores = {};

  for (const dim of dims) {
    const seedVector = getSeedVector(dim);
    if (seedVector) {
      scores[dim] = cosineSimilarity(answerEmbedding, seedVector);
    }
  }

  return scores;
}
