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
  score:       number
  /** Only present when `rerank: true` was passed to search. Range 0-1. */
  relevance_score?: number
  vector_clock?: Record<string, number>
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
