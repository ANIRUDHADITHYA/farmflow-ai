/**
 * Shared mock for @supabase/supabase-js used across all tests.
 * Each test can override individual table/method returns via the helpers below.
 */

type SupaRow = Record<string, unknown>
type SupaError = { message: string; code: string } | null

interface MockQueryResult {
  data: SupaRow | SupaRow[] | null
  error: SupaError
  count?: number | null
}

// Default happy-path result
const ok = (data: SupaRow | SupaRow[] | null = null, count?: number): MockQueryResult => ({
  data,
  error: null,
  ...(count !== undefined ? { count } : {}),
})

const fail = (msg: string, code = 'ERROR'): MockQueryResult => ({
  data: null,
  error: { message: msg, code },
})

// Chainable query builder that resolves to a configurable result
function createQueryBuilder(result: MockQueryResult = ok()): Record<string, ReturnType<typeof vi.fn>> {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {}
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'lt', 'gt', 'lte', 'gte',
    'single', 'order', 'limit', 'filter',
  ]
  for (const m of methods) {
    builder[m] = vi.fn(() => builder)
  }
  // Make the builder thenable so await works
  builder.then = vi.fn((resolve: (v: MockQueryResult) => void) => resolve(result))
  return builder
}

// Per-table result map: table -> method -> result
const tableResults = new Map<string, Map<string, MockQueryResult>>()

function setResult(table: string, method: string, result: MockQueryResult) {
  if (!tableResults.has(table)) tableResults.set(table, new Map())
  tableResults.get(table)!.set(method, result)
}

function getResult(table: string, _method: string): MockQueryResult {
  return tableResults.get(table)?.get(_method) ?? ok()
}

function resetResults() {
  tableResults.clear()
}

// The mock supabase client
const mockFrom = vi.fn((table: string) => {
  return {
    select: vi.fn((_cols?: string, _opts?: Record<string, unknown>) => {
      const r = getResult(table, 'select')
      return createQueryBuilder(r)
    }),
    insert: vi.fn((_row: unknown) => {
      const r = getResult(table, 'insert')
      return createQueryBuilder(r)
    }),
    update: vi.fn((_updates: unknown) => {
      const r = getResult(table, 'update')
      return createQueryBuilder(r)
    }),
    upsert: vi.fn((_row: unknown, _opts?: unknown) => {
      const r = getResult(table, 'upsert')
      return createQueryBuilder(r)
    }),
    delete: vi.fn(() => {
      const r = getResult(table, 'delete')
      return createQueryBuilder(r)
    }),
  }
})

const mockStorage = {
  from: vi.fn(() => ({
    upload: vi.fn(() => ({ error: null })),
    getPublicUrl: vi.fn((name: string) => ({ data: { publicUrl: `https://storage.test/${name}` } })),
  })),
}

const mockSupabase = {
  from: mockFrom,
  storage: mockStorage,
}

export { mockSupabase, setResult, resetResults, ok, fail, createQueryBuilder }
