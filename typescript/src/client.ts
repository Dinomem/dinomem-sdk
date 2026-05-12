import type {
  ClientOptions,
  WriteParams, WriteResult, SearchParams, MemoryHit, Memory,
  ConflictResult, ScratchSetParams, ApiKey, CreateKeyParams, CreateKeyResult,
  Team, Policy, SetPolicyParams, Webhook, CreateWebhookParams, Retention,
  WorkflowUsage, BatchWriteResult, BatchSearchResult,
} from './types.ts'

export const DEFAULT_BASE_URL = 'https://lwbwcuuzoituanwhekyo.supabase.co/functions/v1/api'

export class MemoryStore {
  private readonly apiKey:  string
  private readonly baseUrl: string

  constructor(opts: ClientOptions) {
    this.apiKey  = opts.apiKey
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, '')
  }

  private async req<T>(
    method: string,
    path:   string,
    body?:  unknown,
  ): Promise<T> {
    const r = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })

    if (r.status === 204) return null as T

    const json = await r.json()
    if (!r.ok) {
      throw new AgentMemError(json?.error ?? `HTTP ${r.status}`, r.status)
    }
    return json as T
  }

  // ── Memory ────────────────────────────────────────────────────────────────

  async write(params: WriteParams): Promise<WriteResult> {
    return this.req('POST', '/v1/memory/write', params)
  }

  async search(params: SearchParams): Promise<MemoryHit[]> {
    return this.req('POST', '/v1/memory/search', params)
  }

  async get(id: string): Promise<Memory> {
    return this.req('GET', `/v1/memory/${id}`)
  }

  async delete(id: string): Promise<void> {
    return this.req('DELETE', `/v1/memory/${id}`)
  }

  async checkConflicts(params: {
    content: string; agentId: string; workflowId?: string; scope?: string
  }): Promise<ConflictResult> {
    return this.req('POST', '/v1/memory/conflicts', params)
  }

  // ── Batch ─────────────────────────────────────────────────────────────────

  async batchWrite(writes: WriteParams[]): Promise<BatchWriteResult> {
    return this.req('POST', '/v1/memory/batch/write', { writes })
  }

  async batchSearch(searches: SearchParams[]): Promise<BatchSearchResult> {
    return this.req('POST', '/v1/memory/batch/search', { searches })
  }

  // ── Scratch ───────────────────────────────────────────────────────────────

  async scratchSet(params: ScratchSetParams): Promise<void> {
    const { ttlSecs, ...rest } = params
    return this.req('POST', '/v1/scratch/set', { ...rest, ttl: ttlSecs })
  }

  async scratchGet(workflowId: string, key: string): Promise<string | null> {
    const r = await this.req<{ value: string | null }>('POST', '/v1/scratch/get', { workflowId, key })
    return r.value
  }

  async scratchDel(workflowId: string, key: string): Promise<void> {
    return this.req('POST', '/v1/scratch/del', { workflowId, key })
  }

  // ── Workflows ─────────────────────────────────────────────────────────────

  async summarize(workflowId: string, agentId: string): Promise<string> {
    const r = await this.req<{ summary: string }>('POST', `/v1/workflows/${workflowId}/summarize`, { agentId })
    return r.summary
  }

  async workflowMemories(workflowId: string): Promise<MemoryHit[]> {
    return this.req('GET', `/v1/workflows/${workflowId}/memories`)
  }

  // ── API Keys ──────────────────────────────────────────────────────────────

  async listKeys(): Promise<ApiKey[]> {
    const r = await this.req<{ keys: ApiKey[] }>('GET', '/v1/keys')
    return r.keys
  }

  async createKey(params: CreateKeyParams): Promise<CreateKeyResult> {
    return this.req('POST', '/v1/keys', params)
  }

  async revokeKey(id: string): Promise<void> {
    return this.req('DELETE', `/v1/keys/${id}`)
  }

  // ── Teams ─────────────────────────────────────────────────────────────────

  async listTeams(): Promise<Team[]> {
    const r = await this.req<{ teams: Team[] }>('GET', '/v1/teams')
    return r.teams
  }

  async createTeam(name: string): Promise<Team> {
    return this.req('POST', '/v1/teams', { name })
  }

  async deleteTeam(id: string): Promise<void> {
    return this.req('DELETE', `/v1/teams/${id}`)
  }

  // ── Conflict policies ─────────────────────────────────────────────────────

  async listPolicies(): Promise<Policy[]> {
    const r = await this.req<{ policies: Policy[] }>('GET', '/v1/policies')
    return r.policies
  }

  async setPolicy(params: SetPolicyParams): Promise<Policy> {
    return this.req('PUT', '/v1/policies', params)
  }

  async deletePolicy(id: string): Promise<void> {
    return this.req('DELETE', `/v1/policies/${id}`)
  }

  // ── Webhooks ──────────────────────────────────────────────────────────────

  async listWebhooks(): Promise<Webhook[]> {
    const r = await this.req<{ webhooks: Webhook[] }>('GET', '/v1/webhooks')
    return r.webhooks
  }

  async createWebhook(params: CreateWebhookParams): Promise<Webhook & { secret: string }> {
    return this.req('POST', '/v1/webhooks', params)
  }

  async enableWebhook(id: string):  Promise<Webhook> {
    return this.req('PATCH', `/v1/webhooks/${id}`, { active: true })
  }

  async disableWebhook(id: string): Promise<Webhook> {
    return this.req('PATCH', `/v1/webhooks/${id}`, { active: false })
  }

  async deleteWebhook(id: string): Promise<void> {
    return this.req('DELETE', `/v1/webhooks/${id}`)
  }

  // ── Org settings ──────────────────────────────────────────────────────────

  async registerByok(customerKey: string): Promise<{ ok: boolean; message: string }> {
    return this.req('POST', '/v1/org/byok', { customerKey })
  }

  async removeByok(): Promise<{ ok: boolean; warning: string }> {
    return this.req('DELETE', '/v1/org/byok')
  }

  async getRetention(): Promise<Retention> {
    return this.req('GET', '/v1/org/retention')
  }

  async setRetention(params: Retention): Promise<{ ok: boolean }> {
    return this.req('PUT', '/v1/org/retention', params)
  }

  async getWorkflowUsage(days = 30): Promise<Record<string, WorkflowUsage>> {
    const r = await this.req<{ workflows: Record<string, WorkflowUsage> }>(
      'GET',
      `/v1/org/usage/workflows?days=${days}`,
    )
    return r.workflows
  }
}

export class AgentMemError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message)
    this.name = 'AgentMemError'
  }
}
