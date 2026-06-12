import crypto from 'crypto';

const ADMIN_USERNAMES = new Set(['m_lova_yulia', 'ivyheroin']);

function normalizeUsername(username = '') {
  return username.replace(/^@/, '').trim().toLowerCase();
}

export function isAdminUser(user) {
  return ADMIN_USERNAMES.has(normalizeUsername(user?.username));
}

export function parseTelegramInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');

  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(calculated), Buffer.from(hash))) return null;

  const userRaw = params.get('user');
  return userRaw ? JSON.parse(userRaw) : null;
}

export function getRequestUser(req) {
  const initData = req.get('x-telegram-init-data');
  const user = parseTelegramInitData(initData, process.env.BOT_TOKEN);
  if (user) return user;

  if (process.env.ALLOW_DEV_AUTH !== 'false') {
    const devUser = req.get('x-dev-user');
    if (devUser) {
      try {
        return JSON.parse(Buffer.from(devUser, 'base64').toString('utf8'));
      } catch {
        return null;
      }
    }
  }

  return null;
}

export function requireAdmin(req, res, next) {
  const user = getRequestUser(req);
  if (!isAdminUser(user)) {
    return res.status(403).json({ error: 'Доступ только для Юлии' });
  }
  req.telegramUser = user;
  return next();
}
