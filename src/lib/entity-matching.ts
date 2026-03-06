export const DEFAULT_NAME_MATCH_THRESHOLD = 0.75;
export const POSSIBLE_NAME_MATCH_THRESHOLD = 0.6;

/** Normalize a string for comparison: lowercase, collapse whitespace, strip common suffixes. */
export function normalizeMatchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[''`]/g, "'")
    .replace(/[^\w\s'&-]/g, '')
    .replace(/\b(the|center|centre|for|of|and|at|in)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Simple Levenshtein distance between two strings. */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Similarity score 0-1 based on Levenshtein distance. */
export function similarityScore(a: string, b: string): number {
  const na = normalizeMatchText(a);
  const nb = normalizeMatchText(b);
  if (na === nb) return 1;
  if (!na || !nb) return 0;
  const dist = levenshteinDistance(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

/** Compute a match score between two names, using multiple strategies. */
export function nameMatchScore(scraped: string, dbName: string): number {
  const nScraped = normalizeMatchText(scraped);
  const nDb = normalizeMatchText(dbName);

  let score = similarityScore(scraped, dbName);

  const shorter = nScraped.length <= nDb.length ? nScraped : nDb;
  if (shorter.includes(' ') && shorter.length > 5) {
    if (nScraped.includes(nDb) || nDb.includes(nScraped)) {
      score = Math.max(score, 0.85);
    }
  }

  const wordsScraped = new Set(nScraped.split(/\s+/).filter((w) => w.length > 1));
  const wordsDb = new Set(nDb.split(/\s+/).filter((w) => w.length > 1));
  if (wordsScraped.size >= 2 && wordsDb.size >= 2) {
    const smaller = wordsScraped.size <= wordsDb.size ? wordsScraped : wordsDb;
    const larger = wordsScraped.size <= wordsDb.size ? wordsDb : wordsScraped;
    let overlap = 0;
    for (const w of smaller) {
      if (larger.has(w)) overlap++;
    }
    const ratio = overlap / smaller.size;
    if (ratio >= 0.8) {
      score = Math.max(score, 0.75 + ratio * 0.1);
    }
  }

  return score;
}

export interface DuplicateCandidate {
  id: string;
  name: string;
  address?: string | null;
}

export interface BestNameMatch {
  id: string;
  score: number;
}

/** Find the best name match candidate, optionally considering address as a lower-weight fallback. */
export function findBestNameMatch(
  name: string | null,
  candidates: DuplicateCandidate[],
  options?: { includeAddress?: boolean }
): BestNameMatch | null {
  if (!name) return null;
  let best: BestNameMatch | null = null;

  for (const candidate of candidates) {
    let score = nameMatchScore(name, candidate.name);

    if (options?.includeAddress && candidate.address) {
      const addrScore = similarityScore(name, candidate.address) * 0.8;
      score = Math.max(score, addrScore);
    }

    if (!best || score > best.score) {
      best = { id: candidate.id, score };
    }
  }

  return best;
}
