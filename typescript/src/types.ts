export interface ClientOptions {
  apiKey:   string
  baseUrl?: string
}

export type Scope = 'private' | 'team' | 'global'
export type Role  = 'planner' | 'executor' | 'observer'
export type ConflictPolicy = 'ignore' | 'planner_wins' | 'timestamp_wins' | 'human_in_loop'
export type WebhookEvent   =
  | 'memory.written'
  | 'memory.deleted'
  | 'memory.expired'
  | 'memory.conflict_blocked'
  | 'memory.conflict_detected'
  | 'memory.superseded'

export interface WriteParams {
  content:    string
  agentId:    string
  scope?:     Scope
  role?:      Role
  workflowId?: string
  expiresAt?: string
}

export interface WriteResult {
  writeId:    string
  duplicate?: boolean
}

export interface SearchParams {
  query:      string
  agentId:    string
  workflowId?: string
  topK?:      number
  scope?:     Scope
  atTime?:    string
  /** Re-rank the top candidates with Gemini for higher relevance. Adds ~500-1500ms latency. */
  rerank?:    boolean
}

export interface MemoryHit {
  id:          string
  content:     string
  agent_id:    string
  scope:       string
  role:        string | null
  workflow_id: string | null
  created_at:  string
  /**
   * Reciprocal Rank Fusion (RRF) score from the hybrid search (semantic +
   * keyword + graph channels). This is an **ordering signal**, not a relevance
   * signal — typical range is ~0–0.04 (a top-of-channels hit caps around 0.04
   * because of the RRF formula `1 / (k + rank + 1)` with k=60).
   *
   * Higher means the memory ranked well across more channels, but a 0.03 score
   * for a near-exact match is normal, not a sign of low quality. Use this
   * field for sorting and for hybrid-mode `minScore` filtering. For a true
   * 0–1 relevance signal, pass `rerank: true` and read `relevance_score`.
   */
  score:       number
  /**
   * Three states:
   * - `number` (0–1): rerank ran and produced a relevance score.
   * - `null`: rerank was requested but failed (e.g. Gemini rate-limit). Do NOT
   *   substitute the raw `score` — the field is null precisely because the
   *   relevance signal is unavailable.
   * - `undefined`: rerank was not requested.
   */
  relevance_score?: number | null
  vector_clock?: Record<string, number>
  /** UUID of the memory that superseded this one, if any. */
  superseded_by?: string | null
}

export interface Memory {
  id:          string
  content:     string
  agent_id:    string
  scope:       string
  role:        string | null
  workflow_id: string | null
  created_at:  string
  expires_at:  string | null
  extracted:   boolean
  encrypted:   boolean
  vector_clock?: Record<string, number>
  /** UUID of the memory that superseded this one, if any. */
  superseded_by?: string | null
  /** Set when the memory has been soft-deleted (expired, superseded, or revoked). */
  deleted_at?:   string | null
}

export interface MemoryHistory {
  memory:        Memory
  /** The memory that replaced this one (one level forward), or null. */
  supersededBy:  Memory | null
  /** Memories this one replaced (one level back). */
  supersedes:    Memory[]
}

export interface Conflict {
  memoryId:    string
  severity:    'high' | 'low'
  description: string
}

export interface ConflictResult {
  conflicts: Conflict[]
}

export interface ScratchSetParams {
  workflowId: string
  key:        string
  value:      string
  ttlSecs?:   number
}

export interface ApiKey {
  id:           string
  name:         string
  key_prefix:   string
  tier:         string
  scoped_agent: string | null
  scoped_scope: string | null
  created_at:   string
  last_used_at: string | null
  revoked_at:   string | null
}

export interface CreateKeyParams {
  name:        string
  tier?:       string
  scopedAgent?: string
  scopedScope?: string
}

export interface CreateKeyResult {
  key: string
  id:  string
}

export interface Team {
  id:         string
  name:       string
  created_at: string
}

export interface Policy {
  id:          string
  workflow_id: string | null
  policy:      ConflictPolicy
  webhook_url: string | null
  created_at:  string
}

export interface SetPolicyParams {
  policy:      ConflictPolicy
  workflowId?: string
  webhookUrl?: string | null
}

export interface AccessGrant {
  id:             string
  grantor_role:   Role
  grantee_agent:  string
  resource_scope: Scope
  valid_from:     string
  valid_to:       string | null
  created_at:     string
}

export interface CreateGrantParams {
  /** Memories with this role become visible to the grantee. */
  grantorRole:   Role
  /** The agent_id that gets access. */
  granteeAgent:  string
  /** Which scope of memories to expose — usually 'private'. */
  resourceScope: Scope
  /** ISO 8601 timestamp; null/omitted = grant never expires. */
  validTo?:      string
}

export interface Webhook {
  id:         string
  url:        string
  events:     WebhookEvent[]
  active:     boolean
  created_at: string
  secret?:    string
}

export interface CreateWebhookParams {
  url:    string
  events: WebhookEvent[]
}

export interface Retention {
  memoriesDays: number | null
  auditDays:    number
  scratchDays:  number
}

export interface WorkflowUsage {
  writes:   number
  searches: number
}

export interface BatchWriteResult {
  results: Array<{ writeId?: string; duplicate?: boolean; error?: string }>
}

export interface BatchSearchResult {
  results: Array<MemoryHit[] | { error: string }>
}

// ── CRDT replica/sync (V3) ────────────────────────────────────────────────────
// Drivable, black-box interface over DinoMem's op-based LWW-Register CvRDT
// engine. Convergence is property-tested (order-independence, the CvRDT laws,
// no-lost-writes) — see the core's lib/crdt-merge.test.ts.

/** A per-replica vector clock: node id → monotonic counter. */
export type VectorClock = Record<string, number>

export interface CrdtWriteParams {
  /** Register key being assigned. */
  key:     string
  /** New value for the register. */
  value:   string
  /** Agent id issuing the op (recorded on the op). */
  agentId: string
}

/** A single op emitted by a replica write. */
export interface CrdtOp {
  opId:    string
  key:     string
  value:   string
  agentId: string
  vclock:  VectorClock
  ts:      string
}

export interface CrdtWriteResult {
  op: CrdtOp
}

export interface CrdtSyncResult {
  /** Number of ops the target replica newly learned from the source. */
  synced: number
}

/** One converged register entry in a replica's state. */
export interface CrdtRegister {
  key:     string
  value:   string
  opId:    string
  agentId: string
}

export interface CrdtStateResult {
  /** The replica's converged register state, sorted by key. */
  state: CrdtRegister[]
}
