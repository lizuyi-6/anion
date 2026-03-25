export function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function titleCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function toId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export function safeJsonParse<T>(value: string, fallback: T) {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function summarizeText(value: string, maxLength = 220) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

export function sentenceSplit(value: string) {
  return value
    .split(/(?<=[。！？!?\.])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function keywordOverlap(a: string, b: string) {
  const normalize = (input: string) => {
    const lowered = input.toLowerCase();
    const spacedTokens = lowered
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((token) => token.length > 1);
    const cjkBigrams = [...lowered]
      .filter((char) => /[\u4E00-\u9FFF]/u.test(char))
      .map((_, index, chars) => chars.slice(index, index + 2).join(""))
      .filter((token) => token.length === 2);

    return [...spacedTokens, ...cjkBigrams];
  };

  const setA = new Set(normalize(a));
  const setB = new Set(normalize(b));

  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let matches = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      matches += 1;
    }
  }

  return matches / Math.max(setA.size, setB.size);
}

export function encodeSseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}
