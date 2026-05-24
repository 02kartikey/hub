/**
 * search.ts — AIhub OS search engine
 *
 * Client-side weighted search with:
 * - TF-IDF style scoring on title/description/tags/topics
 * - Trigram fuzzy matching (catches typos like "promting" → "prompting")
 * - Synonym expansion (llm→language model, gpt→chatgpt, etc.)
 * - Natural language intent extraction (difficulty, type, board filters)
 * - Zero server round-trips for instant results
 */

import type { Resource, LearningPath } from './types'

// ── Synonym map ───────────────────────────────────────────────────────────────

const SYNONYMS: Record<string, string[]> = {
  'llm':        ['large language model', 'language model', 'gpt', 'chatgpt', 'transformer'],
  'gpt':        ['chatgpt', 'openai', 'large language model', 'llm'],
  'prompt':     ['prompting', 'prompt engineering', 'instruction'],
  'prompting':  ['prompt', 'prompt engineering', 'instruction following'],
  'nn':         ['neural network', 'deep learning', 'neural net'],
  'ml':         ['machine learning', 'deep learning'],
  'ai':         ['artificial intelligence', 'machine learning', 'deep learning'],
  'bias':       ['fairness', 'discrimination', 'ethics'],
  'safety':     ['alignment', 'ethics', 'risks'],
  'alignment':  ['safety', 'rlhf', 'human feedback'],
  'hallucin':   ['hallucination', 'confabulation', 'making things up'],
  'beginner':   ['easy', 'introductory', 'intro', 'start', 'basics'],
  'advanced':   ['hard', 'expert', 'deep', 'research'],
  'teacher':    ['educator', 'classroom', 'teaching', 'pedagogy'],
  'student':    ['learner', 'learn', 'study'],
  'cbse':       ['board', 'class 9', 'class 10', 'class 11', 'class 12'],
  'video':      ['watch', 'youtube', 'lecture', 'talk'],
  'book':       ['read', 'reading', 'textbook'],
  'course':     ['curriculum', 'class', 'series'],
  'guide':      ['how to', 'howto', 'tutorial', 'walkthrough'],
}

// ── Intent extraction ─────────────────────────────────────────────────────────
// Parses natural language like "beginner videos about neural networks"
// into structured filters

export interface SearchIntent {
  cleanQuery: string
  difficulty?: string
  type?: string
  board?: string
}

export function extractIntent(raw: string): SearchIntent {
  let q = raw.toLowerCase().trim()
  const intent: SearchIntent = { cleanQuery: q }

  const DIFFICULTY_PATTERNS: [RegExp, string][] = [
    [/\b(beginner|easy|simple|basic|intro|introductory|start)\b/g, 'beginner'],
    [/\b(intermediate|medium|moderate)\b/g, 'intermediate'],
    [/\b(advanced|hard|expert|difficult|deep|research)\b/g, 'advanced'],
  ]
  for (const [re, val] of DIFFICULTY_PATTERNS) {
    if (re.test(q)) { intent.difficulty = val; q = q.replace(re, '').trim() }
  }

  const TYPE_PATTERNS: [RegExp, string][] = [
    [/\b(video|watch|youtube|lecture)\b/g, 'video'],
    [/\b(book|read|textbook)\b/g, 'book'],
    [/\b(course|class|curriculum)\b/g, 'course'],
    [/\b(article|blog|post)\b/g, 'article'],
    [/\b(seminar|workshop|conference)\b/g, 'seminar'],
    [/\b(guide|tutorial|howto|how.to)\b/g, 'guide'],
  ]
  for (const [re, val] of TYPE_PATTERNS) {
    if (re.test(q)) { intent.type = val; q = q.replace(re, '').trim() }
  }

  const BOARD_PATTERNS: [RegExp, string][] = [
    [/\b(cbse|class\s*\d+)\b/g, 'CBSE'],
    [/\b(igcse)\b/g, 'IGCSE'],
    [/\b(ib|international baccalaureate)\b/g, 'IB'],
    [/\b(rbse|rajasthan)\b/g, 'RBSE'],
  ]
  for (const [re, val] of BOARD_PATTERNS) {
    if (re.test(q)) { intent.board = val; q = q.replace(re, '').trim() }
  }

  intent.cleanQuery = q.replace(/\s+/g, ' ').trim()
  return intent
}

// ── Tokeniser ─────────────────────────────────────────────────────────────────

function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1)
}

function expandTokens(tokens: string[]): string[] {
  const expanded = new Set<string>(tokens)
  for (const t of tokens) {
    const syns = SYNONYMS[t]
    if (syns) {
      syns.forEach(s => tokenise(s).forEach(st => expanded.add(st)))
    }
    // Partial synonym keys (prefix match)
    for (const [key, syns2] of Object.entries(SYNONYMS)) {
      if (key.startsWith(t) || t.startsWith(key)) {
        syns2.forEach(s => tokenise(s).forEach(st => expanded.add(st)))
      }
    }
  }
  return Array.from(expanded)
}

// ── Trigram fuzzy matching ────────────────────────────────────────────────────

function trigrams(s: string): Set<string> {
  const out = new Set<string>()
  const padded = `  ${s}  `
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3))
  return out
}

function trigramSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  const ta = trigrams(a), tb = trigrams(b)
  let inter = 0
  ta.forEach(t => { if (tb.has(t)) inter++ })
  return (2 * inter) / (ta.size + tb.size)
}

// ── Search index ──────────────────────────────────────────────────────────────

interface IndexEntry {
  id:     string
  type:   'resource' | 'path'
  title:  string
  tokens: string[]
  raw:    Resource | LearningPath
  difficulty?: string
  resType?: string
  boards?: string[]
}

let _index: IndexEntry[] = []
let _indexBuilt = false

export function buildSearchIndex(resources: Resource[], paths: LearningPath[]) {
  _index = [
    ...resources.map(r => ({
      id: r.id, type: 'resource' as const, title: r.title,
      tokens: tokenise([r.title, r.description, ...(r.topics ?? []), ...(r.tags ?? []), r.author ?? '', r.source ?? ''].join(' ')),
      raw: r, difficulty: r.difficulty, resType: r.type, boards: r.boards,
    })),
    ...paths.map(p => ({
      id: p.id, type: 'path' as const, title: p.title,
      tokens: tokenise([p.title, p.description, ...(p.topics ?? [])].join(' ')),
      raw: p, difficulty: p.difficulty,
    })),
  ]
  _indexBuilt = true
}

export function isIndexReady() { return _indexBuilt }

// ── Scoring ───────────────────────────────────────────────────────────────────

function scoreEntry(entry: IndexEntry, queryTokens: string[], rawQuery: string): number {
  let score = 0

  // Exact title match (highest weight)
  const titleLower = entry.title.toLowerCase()
  if (titleLower.includes(rawQuery.toLowerCase())) score += 40
  if (titleLower.startsWith(rawQuery.toLowerCase())) score += 20

  // Token matching (tf-idf approximation)
  for (const qt of queryTokens) {
    // Exact token match
    const exactMatches = entry.tokens.filter(t => t === qt).length
    score += exactMatches * 8

    // Prefix match
    const prefixMatches = entry.tokens.filter(t => t.startsWith(qt) && t !== qt).length
    score += prefixMatches * 4

    // Trigram fuzzy match on title tokens
    const titleTokens = tokenise(entry.title)
    for (const tt of titleTokens) {
      const sim = trigramSimilarity(qt, tt)
      if (sim > 0.5) score += sim * 12
    }

    // Fuzzy match on description tokens
    for (const et of entry.tokens) {
      const sim = trigramSimilarity(qt, et)
      if (sim > 0.6) score += sim * 3
    }
  }

  // Boost for featured / completion count
  if (entry.type === 'resource') {
    const r = entry.raw as Resource
    if (r.isFeatured) score += 5
    if (r.completionCount) score += Math.min(r.completionCount / 500, 5)
  }

  return score
}

// ── Main search function ──────────────────────────────────────────────────────

export interface SearchResult {
  id:    string
  type:  'resource' | 'path'
  score: number
  raw:   Resource | LearningPath
}

export function search(
  rawQuery: string,
  opts: { limit?: number; resourcesOnly?: boolean } = {}
): { results: SearchResult[]; intent: SearchIntent } {
  const { limit = 12, resourcesOnly = false } = opts
  const intent = extractIntent(rawQuery)
  const q = intent.cleanQuery
  if (!q) return { results: [], intent }

  const baseTokens = tokenise(q)
  const queryTokens = expandTokens(baseTokens)

  let candidates = resourcesOnly ? _index.filter(e => e.type === 'resource') : _index

  // Apply intent filters
  if (intent.difficulty) candidates = candidates.filter(e => e.difficulty === intent.difficulty)
  if (intent.type)       candidates = candidates.filter(e => e.type === 'resource' && e.resType === intent.type)
  if (intent.board)      candidates = candidates.filter(e => !e.boards || e.boards.includes(intent.board!) || e.boards.includes('All'))

  const scored = candidates
    .map(e => ({ ...e, score: scoreEntry(e, queryTokens, q) }))
    .filter(e => e.score > 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return {
    results: scored.map(e => ({ id: e.id, type: e.type, score: e.score, raw: e.raw })),
    intent,
  }
}
