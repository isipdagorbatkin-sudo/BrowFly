import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const storePath = path.join(dataDir, 'store.json');
const stateId = 'main';

const defaultStore = {
  profile: {
    name: '',
    username: '',
    title: '',
    address: '',
    description: '',
    socials: [],
    avatarUrl: '',
    gallery: []
  },
  services: [],
  schedule: {
    timezone: 'Europe/Moscow',
    dateSlots: {},
    workDays: {
      '1': [],
      '2': [],
      '3': [],
      '4': [],
      '5': [],
      '6': [],
      '0': []
    },
    blockedDates: [],
    blockedSlots: []
  },
  appointments: [],
  reviews: [],
  adminChatIds: []
};

let schemaReady = false;

function useSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getDatabaseUrl() {
  const password = encodeURIComponent(process.env.SUPABASE_DB_PASSWORD || '');
  const ref = new URL(process.env.SUPABASE_URL).hostname.split('.')[0];
  const poolerHost = process.env.SUPABASE_POOLER_HOST;

  if (poolerHost) {
    return `postgresql://postgres.${ref}:${password}@${poolerHost}:6543/postgres`;
  }

  return `postgresql://postgres:${password}@db.${ref}.supabase.co:5432/postgres`;
}

function openSql() {
  return postgres(getDatabaseUrl(), {
    ssl: 'require',
    max: 1,
    idle_timeout: 5,
    connect_timeout: 20
  });
}

async function ensureSupabaseStore() {
  if (schemaReady) return;

  const sql = openSql();

  try {
    await sql`
      create table if not exists public.app_state (
        id text primary key,
        payload jsonb not null,
        updated_at timestamptz not null default now()
      )
    `;

    await sql`
      insert into public.app_state (id, payload)
      values (${stateId}, ${sql.json(defaultStore)})
      on conflict (id) do nothing
    `;

    schemaReady = true;
  } finally {
    await sql.end();
  }
}

function ensureLocalStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(storePath)) {
    fs.writeFileSync(storePath, JSON.stringify(defaultStore, null, 2), 'utf8');
  }
}

export async function ensureStore() {
  if (useSupabase()) {
    await ensureSupabaseStore();
    return;
  }

  ensureLocalStore();
}

export async function readStore() {
  if (useSupabase()) {
    await ensureSupabaseStore();
    const sql = openSql();
    try {
      const rows = await sql`
        select payload
        from public.app_state
        where id = ${stateId}
        limit 1
      `;
      return rows[0]?.payload || defaultStore;
    } finally {
      await sql.end();
    }
  }

  ensureLocalStore();
  return JSON.parse(fs.readFileSync(storePath, 'utf8'));
}

export async function writeStore(nextStore) {
  if (useSupabase()) {
    await ensureSupabaseStore();
    const sql = openSql();
    try {
      await sql`
        insert into public.app_state (id, payload, updated_at)
        values (${stateId}, ${sql.json(nextStore)}, now())
        on conflict (id)
        do update set payload = excluded.payload, updated_at = now()
      `;
      return nextStore;
    } finally {
      await sql.end();
    }
  }

  ensureLocalStore();
  fs.writeFileSync(storePath, JSON.stringify(nextStore, null, 2), 'utf8');
  return nextStore;
}

export async function updateStore(updater) {
  const store = await readStore();
  const nextStore = updater(store) || store;
  return writeStore(nextStore);
}

export function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
