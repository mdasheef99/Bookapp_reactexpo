export type EdgeAuthScript = {
  user?: { id: string } | null;
  error?: unknown;
};

export type EdgeTableScript = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

export type EdgeRpcScript = {
  data?: unknown;
  error?: unknown;
  reject?: unknown;
};

export type EdgeScript = {
  auth?: EdgeAuthScript;
  tables?: Record<string, EdgeTableScript | EdgeTableScript[]>;
  rpc?: EdgeRpcScript | EdgeRpcScript[];
};

export type EdgeRecordedCall =
  | { kind: 'createClient'; url: string; key: string; options: unknown }
  | { kind: 'auth.getUser'; key: string }
  | {
      kind: 'table';
      key: string;
      table: string;
      select: { arg: unknown; options: unknown } | null;
      filters: Array<{ op: 'eq' | 'or'; args: unknown[] }>;
      awaitedAs: 'implicit' | 'maybeSingle';
    }
  | { kind: 'rpc'; key: string; name: string; args: unknown };

type EdgeServeHandler = (req: Request) => Promise<Response> | Response;

let env: Record<string, string> = {};
let script: EdgeScript = {};
const tableQueues = new Map<string, { items: EdgeTableScript[]; fallback: EdgeTableScript }>();
let rpcQueue: { items: EdgeRpcScript[]; fallback: EdgeRpcScript } = { items: [], fallback: {} };
const records: EdgeRecordedCall[] = [];
const serveHandlers: EdgeServeHandler[] = [];

const globalWithDeno = globalThis as any;
if (!globalWithDeno.Deno) globalWithDeno.Deno = {};
if (!globalWithDeno.Deno.env) {
  globalWithDeno.Deno.env = {
    get: (name: string): string | undefined => env[name],
  };
}

export function serve(handler: EdgeServeHandler): { finished: boolean } {
  serveHandlers.push(handler);
  return { finished: false };
}

function normalizeTableResult(tableScript: EdgeTableScript): {
  data: unknown;
  error: unknown;
  count: number | null;
} {
  return {
    data: tableScript.data ?? null,
    error: tableScript.error ?? null,
    count: tableScript.count ?? null,
  };
}

function nextTableScript(table: string): EdgeTableScript {
  const queue = tableQueues.get(table);
  if (!queue) return {};
  const next = queue.items.shift();
  return next ?? queue.fallback;
}

function buildTableClient(key: string, table: string): any {
  const record: Extract<EdgeRecordedCall, { kind: 'table' }> = {
    kind: 'table',
    key,
    table,
    select: null,
    filters: [],
    awaitedAs: 'implicit',
  };
  const builder: any = {
    select: (arg: unknown, options?: unknown) => {
      record.select = { arg, options: options ?? null };
      return builder;
    },
    eq: (column: unknown, value: unknown) => {
      record.filters.push({ op: 'eq', args: [column, value] });
      return builder;
    },
    or: (expression: unknown) => {
      record.filters.push({ op: 'or', args: [expression] });
      return builder;
    },
    maybeSingle: async () => {
      record.awaitedAs = 'maybeSingle';
      records.push(record);
      return normalizeTableResult(nextTableScript(table));
    },
    then: (
      onFulfilled?: (value: unknown) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => {
      records.push(record);
      return Promise.resolve(normalizeTableResult(nextTableScript(table))).then(
        onFulfilled,
        onRejected,
      );
    },
  };
  return builder;
}

function buildRpcCall(
  key: string,
  name: string,
  args: unknown,
): Promise<{ data: unknown; error: unknown }> {
  const next = rpcQueue.items.shift() ?? rpcQueue.fallback;
  records.push({ kind: 'rpc', key, name, args });
  if (next.reject !== undefined) {
    return Promise.reject(next.reject);
  }
  return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
}

export function createClient(url: string, key: string, options?: unknown): any {
  records.push({ kind: 'createClient', url, key, options: options ?? null });
  return {
    auth: {
      getUser: async () => {
        records.push({ kind: 'auth.getUser', key });
        const authScript = script.auth ?? {};
        return { data: { user: authScript.user ?? null }, error: authScript.error ?? null };
      },
    },
    from: (table: string) => buildTableClient(key, table),
    rpc: (name: string, args: unknown) => buildRpcCall(key, name, args),
  };
}

export function __setEdgeEnv(values: Record<string, string>): void {
  env = { ...values };
}

export function __scriptEdgeResults(next: EdgeScript): void {
  script = next;
  tableQueues.clear();
  if (next.tables) {
    for (const [table, value] of Object.entries(next.tables)) {
      const items = Array.isArray(value) ? value : [value];
      tableQueues.set(table, { items: [...items], fallback: items[items.length - 1] ?? {} });
    }
  }
  if (next.rpc) {
    const items = Array.isArray(next.rpc) ? next.rpc : [next.rpc];
    rpcQueue = { items: [...items], fallback: items[items.length - 1] ?? {} };
  } else {
    rpcQueue = { items: [], fallback: {} };
  }
}

export function __capturedServeHandlers(): EdgeServeHandler[] {
  return serveHandlers;
}

export function __recordedCalls(): readonly EdgeRecordedCall[] {
  return records;
}

export function __resetBetweenTests(): void {
  records.length = 0;
  script = {};
  tableQueues.clear();
  rpcQueue = { items: [], fallback: {} };
  env = {};
}
