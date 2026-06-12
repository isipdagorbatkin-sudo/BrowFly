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
    name: '\u042e\u043b\u0438\u044f',
    username: 'm_lova_yulia',
    title: '\u0420\u0435\u0441\u043d\u0438\u0446\u044b \u0438 \u0431\u0440\u043e\u0432\u0438',
    address: '\u0433 \u041c\u043e\u0441\u043a\u0432\u0430, \u0443\u043b \u0421\u0442\u0440\u043e\u0438\u0442\u0435\u043b\u0435\u0439, \u0434 11 \u043a 3',
    description:
      '\u0410\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u0430\u044f \u0440\u0430\u0431\u043e\u0442\u0430, \u043a\u043e\u043c\u0444\u043e\u0440\u0442\u043d\u0430\u044f \u0430\u0442\u043c\u043e\u0441\u0444\u0435\u0440\u0430 \u0438 \u043f\u0440\u043e\u0446\u0435\u0434\u0443\u0440\u044b, \u043f\u043e\u0441\u043b\u0435 \u043a\u043e\u0442\u043e\u0440\u044b\u0445 \u0445\u043e\u0447\u0435\u0442\u0441\u044f \u0441\u0440\u0430\u0437\u0443 \u0437\u0430\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f \u0441\u043d\u043e\u0432\u0430.',
    socials: [
      { id: 'soc_tg', type: 'telegram', label: 'Telegram', url: 'https://t.me/m_lova_yulia' },
      { id: 'soc_vk', type: 'vk', label: 'VK', url: 'https://vk.com/' },
      { id: 'soc_inst', type: 'instagram', label: 'Instagram', url: 'https://instagram.com/' }
    ],
    avatarUrl: '',
    gallery: []
  },
  services: [
    {
      id: 'cat_lashes',
      title: '\u0420\u0435\u0441\u043d\u0438\u0446\u044b',
      description: '\u041d\u0430\u0440\u0430\u0449\u0438\u0432\u0430\u043d\u0438\u0435, \u043b\u0430\u043c\u0438\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0438 \u0443\u0445\u043e\u0434',
      items: [
        {
          id: 'svc_lash_classic',
          title: '\u041a\u043b\u0430\u0441\u0441\u0438\u0447\u0435\u0441\u043a\u043e\u0435 \u043d\u0430\u0440\u0430\u0449\u0438\u0432\u0430\u043d\u0438\u0435',
          description: '\u0415\u0441\u0442\u0435\u0441\u0442\u0432\u0435\u043d\u043d\u044b\u0439 \u044d\u0444\u0444\u0435\u043a\u0442 \u043d\u0430 \u043a\u0430\u0436\u0434\u044b\u0439 \u0434\u0435\u043d\u044c.',
          durationMinutes: 120,
          price: 3700,
          photos: []
        },
        {
          id: 'svc_lash_lami',
          title: '\u041b\u0430\u043c\u0438\u043d\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0435 \u0440\u0435\u0441\u043d\u0438\u0446',
          description: '\u0418\u0437\u0433\u0438\u0431, \u0446\u0432\u0435\u0442 \u0438 \u0443\u0445\u043e\u0434 \u0431\u0435\u0437 \u043d\u0430\u0440\u0430\u0449\u0438\u0432\u0430\u043d\u0438\u044f.',
          durationMinutes: 90,
          price: 3000,
          photos: []
        }
      ]
    },
    {
      id: 'cat_brows',
      title: '\u0411\u0440\u043e\u0432\u0438',
      description: '\u041a\u043e\u0440\u0440\u0435\u043a\u0446\u0438\u044f, \u043e\u043a\u0440\u0430\u0448\u0438\u0432\u0430\u043d\u0438\u0435 \u0438 \u0434\u043e\u043b\u0433\u043e\u0432\u0440\u0435\u043c\u0435\u043d\u043d\u0430\u044f \u0443\u043a\u043b\u0430\u0434\u043a\u0430',
      items: [
        {
          id: 'svc_brows_shape',
          title: '\u041a\u043e\u0440\u0440\u0435\u043a\u0446\u0438\u044f \u0438 \u043e\u043a\u0440\u0430\u0448\u0438\u0432\u0430\u043d\u0438\u0435',
          description: '\u0424\u043e\u0440\u043c\u0430, \u0446\u0432\u0435\u0442 \u0438 \u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u0430\u044f \u0443\u043a\u043b\u0430\u0434\u043a\u0430.',
          durationMinutes: 60,
          price: 2200,
          photos: []
        }
      ]
    }
  ],
  schedule: {
    timezone: 'Europe/Moscow',
    workDays: {
      '1': ['10:00', '12:00', '14:00', '16:00', '18:00'],
      '2': ['10:00', '12:00', '14:00', '16:00', '18:00'],
      '3': ['10:00', '12:00', '14:00', '16:00', '18:00'],
      '4': ['10:00', '12:00', '14:00', '16:00', '18:00'],
      '5': ['10:00', '12:00', '14:00', '16:00'],
      '6': ['11:00', '13:00', '15:00'],
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
