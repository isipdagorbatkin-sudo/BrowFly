import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { getRequestUser, isAdminUser, requireAdmin } from './auth.js';
import {
  findService,
  getAppointmentServiceIds,
  getAvailableSlots,
  getMonthAvailability,
  getServicesSummary,
  normalizeServiceIds,
  toDateTime
} from './availability.js';
import { makeId, readStore, updateStore } from './store.js';
import { ensureLocalUploadsDir, makeUploadMiddleware, saveUpload } from './storage.js';

const app = express();
const upload = makeUploadMiddleware(multer);

app.use(cors());
app.use(express.json({ limit: '3mb' }));
app.use('/uploads', express.static(ensureLocalUploadsDir()));

function publicPayload(store) {
  const averageRating =
    store.reviews.length === 0
      ? 0
      : store.reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / store.reviews.length;
  return {
    profile: store.profile,
    services: store.services,
    reviews: store.reviews,
    rating: {
      average: Number(averageRating.toFixed(1)),
      count: store.reviews.length
    }
  };
}

function asyncRoute(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function getRequestedServiceIds(req) {
  return normalizeServiceIds(req.body?.serviceIds || req.query.serviceIds || req.body?.serviceId || req.query.serviceId);
}

function hasAllServices(store, serviceIds) {
  const ids = normalizeServiceIds(serviceIds);
  return ids.length > 0 && ids.every((serviceId) => findService(store, serviceId));
}

function enrichAppointment(store, appointment) {
  const serviceIds = getAppointmentServiceIds(appointment);
  const summary = getServicesSummary(store, serviceIds);
  return {
    ...appointment,
    serviceIds,
    serviceId: appointment.serviceId || serviceIds[0] || '',
    service: summary.services[0] || null,
    services: summary.services,
    categories: summary.categories,
    totalPrice: summary.totalPrice,
    totalDurationMinutes: summary.totalDurationMinutes
  };
}

function normalizeSocialUrl(label, value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^https?:\/\//i.test(raw)) return raw;

  const username = raw.replace(/^@/, '').replace(/^https?:\/\/[^/]+\//i, '').trim();
  const key = String(label || '').toLowerCase();

  if (key.includes('vk') || key.includes('вк')) return `https://vk.com/${username}`;
  if (key.includes('inst') || key.includes('instagram') || key.includes('инст')) return `https://instagram.com/${username}`;
  if (key.includes('tik') || key.includes('tiktok')) return `https://www.tiktok.com/@${username}`;
  if (key.includes('telegram') || key.includes('tg') || key.includes('тел')) return `https://t.me/${username}`;
  if (raw.startsWith('@')) return `https://t.me/${username}`;

  return raw;
}

function normalizeProfile(profile, fallback) {
  return {
    ...fallback,
    ...profile,
    socials: Array.isArray(profile.socials)
      ? profile.socials.slice(0, 8).map((social) => ({
          ...social,
          label: String(social.label || '').trim(),
          type: String(social.type || social.label || 'link').trim(),
          url: normalizeSocialUrl(social.label || social.type, social.url)
        }))
      : fallback.socials,
    gallery: Array.isArray(profile.gallery) ? profile.gallery.slice(0, 3) : fallback.gallery
  };
}

async function sendTelegramMessage(chatId, text, extra = {}) {
  if (!process.env.BOT_TOKEN || !chatId) return { ok: false, skipped: true };

  const response = await fetch(`https://api.telegram.org/bot${process.env.BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...extra
    })
  });

  return response.json().catch(() => ({ ok: response.ok }));
}

function formatAppointmentMessage(title, store, appointment) {
  const enriched = enrichAppointment(store, appointment);
  const services = enriched.services.map((service) => service.title).join(', ') || 'услуга';
  return [
    title,
    `Услуги: ${services}`,
    `Дата: ${appointment.date}`,
    `Время: ${appointment.time}`,
    `Итого: ${enriched.totalPrice || 0} ₽`,
    `Длительность: ${enriched.totalDurationMinutes || 0} мин`
  ].join('\n');
}

async function notifyAppointmentCreated(store, appointment) {
  const clientMessage = [
    'Запись создана!',
    formatAppointmentMessage('Информация о записи', store, appointment),
    '',
    'Посмотреть запись можно во вкладке «Мои записи».'
  ].join('\n');

  const adminMessage = [
    'Новая запись',
    `Клиент: ${appointment.user?.first_name || 'Клиент'} ${appointment.user?.username ? `@${appointment.user.username}` : ''}`,
    formatAppointmentMessage('Детали', store, appointment)
  ].join('\n');

  await Promise.allSettled([
    sendTelegramMessage(appointment.user?.id, clientMessage),
    ...(store.adminChatIds || []).map((chatId) => sendTelegramMessage(chatId, adminMessage))
  ]);
}

app.get('/api/me', (req, res) => {
  const user = getRequestUser(req);
  res.json({ user, isAdmin: isAdminUser(user) });
});

app.post('/api/telegram/webhook', asyncRoute(async (req, res) => {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (secret && req.get('x-telegram-bot-api-secret-token') !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const message = req.body?.message || req.body?.edited_message;
  const chatId = message?.chat?.id;
  const user = message?.from;
  const text = String(message?.text || '');

  if (!chatId || !user) return res.json({ ok: true });

  if (isAdminUser(user)) {
    await updateStore((draft) => {
      draft.adminChatIds = [...new Set([...(draft.adminChatIds || []), chatId])];
    });
  }

  if (text.startsWith('/start') || text.startsWith('/admin')) {
    const webAppUrl = process.env.PUBLIC_WEBAPP_URL || 'https://brow-fly.vercel.app/';
    const url = isAdminUser(user) ? `${webAppUrl}?admin=1` : webAppUrl;
    await sendTelegramMessage(
      chatId,
      isAdminUser(user)
        ? 'Админка подключена. Теперь сюда будут приходить новые записи.'
        : 'Привет! Здесь можно записаться к Юлии и получать уведомления о записи.',
      {
        reply_markup: {
          inline_keyboard: [[
            { text: isAdminUser(user) ? 'Открыть админку' : 'Открыть запись', web_app: { url } }
          ]]
        }
      }
    );
  }

  res.json({ ok: true });
}));

app.get('/api/public/profile', asyncRoute(async (_req, res) => {
  res.json(publicPayload(await readStore()));
}));

app.get('/api/public/availability', asyncRoute(async (req, res) => {
  const store = await readStore();
  const serviceIds = getRequestedServiceIds(req);
  const month = String(req.query.month || '');
  const match = month.match(/^(\d{4})-(\d{2})$/);

  if (!hasAllServices(store, serviceIds)) {
    return res.status(404).json({ error: '\u0423\u0441\u043b\u0443\u0433\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430' });
  }

  if (!match) {
    return res.status(400).json({ error: '\u041d\u0443\u0436\u0435\u043d month \u0432 \u0444\u043e\u0440\u043c\u0430\u0442\u0435 YYYY-MM' });
  }

  res.json({ days: getMonthAvailability(store, Number(match[1]), Number(match[2]), serviceIds) });
}));

app.get('/api/public/slots', asyncRoute(async (req, res) => {
  const store = await readStore();
  const serviceIds = getRequestedServiceIds(req);
  const date = String(req.query.date || '');

  if (!hasAllServices(store, serviceIds)) {
    return res.status(404).json({ error: '\u0423\u0441\u043b\u0443\u0433\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430' });
  }

  res.json({ slots: getAvailableSlots(store, date, serviceIds) });
}));

app.post('/api/appointments', asyncRoute(async (req, res) => {
  const store = await readStore();
  const user = getRequestUser(req) || req.body.user || {};
  const { date, time } = req.body;
  const serviceIds = getRequestedServiceIds(req);

  if (!hasAllServices(store, serviceIds)) {
    return res.status(404).json({ error: '\u0423\u0441\u043b\u0443\u0433\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430' });
  }

  if (!getAvailableSlots(store, date, serviceIds).includes(time)) {
    return res.status(409).json({ error: '\u042d\u0442\u043e \u0432\u0440\u0435\u043c\u044f \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442\u043e \u0438\u043b\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e' });
  }

  let appointment;
  const nextStore = await updateStore((draft) => {
    appointment = {
      id: makeId('apt'),
      serviceId: serviceIds[0],
      serviceIds,
      date,
      time,
      user,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    draft.appointments.push(appointment);
  });

  await notifyAppointmentCreated(nextStore, appointment).catch(() => {});
  res.status(201).json({ appointment: enrichAppointment(nextStore, appointment) });
}));

function sameUser(left = {}, right = {}) {
  if (left.id && right.id) return String(left.id) === String(right.id);
  if (left.username && right.username) {
    return String(left.username).replace('@', '').toLowerCase() === String(right.username).replace('@', '').toLowerCase();
  }
  return false;
}

app.get('/api/my/appointments', asyncRoute(async (req, res) => {
  const store = await readStore();
  const user = getRequestUser(req);
  const appointments = store.appointments
    .filter((appointment) => sameUser(appointment.user, user))
    .map((appointment) => {
      const review = store.reviews.find((item) => item.appointmentId === appointment.id);
      return {
        ...enrichAppointment(store, appointment),
        review: review || null
      };
    })
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

  res.json({ appointments });
}));

app.patch('/api/my/appointments/:id', asyncRoute(async (req, res) => {
  const user = getRequestUser(req) || req.body.user || {};
  let appointment;
  let store;

  try {
    store = await updateStore((draft) => {
      const current = draft.appointments.find((item) => item.id === req.params.id);
      if (!current) throw new Error('appointment_not_found');
      if (!sameUser(current.user, user)) throw new Error('appointment_forbidden');
      if (req.body.status === 'cancelled') {
        current.status = 'cancelled';
        current.cancelledBy = 'client';
        current.cancelledAt = new Date().toISOString();
      }
      appointment = current;
    });
  } catch (error) {
    if (error.message === 'appointment_not_found') return res.status(404).json({ error: '\u0417\u0430\u043f\u0438\u0441\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430' });
    if (error.message === 'appointment_forbidden') return res.status(403).json({ error: '\u042d\u0442\u043e \u043d\u0435 \u0432\u0430\u0448\u0430 \u0437\u0430\u043f\u0438\u0441\u044c' });
    throw error;
  }

  res.json({ appointment: enrichAppointment(store, appointment) });
}));

app.post('/api/reviews', asyncRoute(async (req, res) => {
  const user = getRequestUser(req) || req.body.user || {};
  const { appointmentId, rating, text } = req.body;
  const normalizedRating = Math.max(1, Math.min(5, Number(rating)));
  let review;

  try {
    await updateStore((draft) => {
      const appointment = draft.appointments.find((item) => item.id === appointmentId);
      if (!appointment) throw new Error('appointment_not_found');
      const existing = draft.reviews.find((item) => item.appointmentId === appointmentId);
      if (existing) {
        existing.rating = normalizedRating;
        existing.text = String(text || '').slice(0, 700);
        existing.updatedAt = new Date().toISOString();
        review = existing;
        return;
      }

      review = {
        id: makeId('rev'),
        appointmentId,
        rating: normalizedRating,
        text: String(text || '').slice(0, 700),
        user,
        createdAt: new Date().toISOString()
      };
      draft.reviews.push(review);
    });
  } catch (error) {
    if (error.message === 'appointment_not_found') {
      return res.status(404).json({ error: '\u0417\u0430\u043f\u0438\u0441\u044c \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430' });
    }
    throw error;
  }

  res.status(201).json({ review });
}));

app.get('/api/cron/reminders', asyncRoute(async (req, res) => {
  const cronSecret = process.env.CRON_SECRET;
  const auth = String(req.headers.authorization || '');
  const isVercelCron = req.headers['x-vercel-cron'] === '1';

  if (cronSecret && auth !== `Bearer ${cronSecret}` && !isVercelCron) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const store = await readStore();
  const now = new Date();
  const windowStart = new Date(now.getTime() + 3 * 60 * 60_000 - 5 * 60_000);
  const windowEnd = new Date(now.getTime() + 3 * 60 * 60_000 + 10 * 60_000);
  const due = store.appointments.filter((appointment) => {
    if (appointment.status === 'cancelled' || appointment.reminderSentAt || !appointment.user?.id) return false;
    const startsAt = toDateTime(appointment.date, appointment.time);
    return startsAt >= windowStart && startsAt <= windowEnd;
  });

  const results = await Promise.allSettled(
    due.map((appointment) => {
      const enriched = enrichAppointment(store, appointment);
      const services = enriched.services.map((service) => service.title).join(', ') || 'услуга';
      return sendTelegramMessage(
        appointment.user.id,
        [
          'Напоминание о записи',
          `Через 3 часа запись к Юлии: ${services}.`,
          `Дата: ${appointment.date}`,
          `Время: ${appointment.time}`
        ].join('\n')
      );
    })
  );

  const storeAfterSend = await updateStore((draft) => {
    due.forEach((appointment, index) => {
      const current = draft.appointments.find((item) => item.id === appointment.id);
      if (!current) return;
      const value = results[index];
      if (value.status === 'fulfilled' && value.value?.ok !== false) {
        current.reminderSentAt = new Date().toISOString();
        delete current.reminderError;
      } else {
        current.reminderError = value.reason?.message || value.value?.description || 'send_failed';
      }
    });
  });

  res.json({
    checked: store.appointments.length,
    due: due.length,
    sent: storeAfterSend.appointments.filter((appointment) => appointment.reminderSentAt).length
  });
}));

app.get('/api/admin/dashboard', requireAdmin, asyncRoute(async (_req, res) => {
  res.json(await readStore());
}));

app.put('/api/admin/profile', requireAdmin, asyncRoute(async (req, res) => {
  const profile = req.body.profile;
  const store = await updateStore((draft) => {
    draft.profile = normalizeProfile(profile, draft.profile);
  });

  res.json(publicPayload(store));
}));

app.put('/api/admin/services', requireAdmin, asyncRoute(async (req, res) => {
  const store = await updateStore((draft) => {
    draft.services = Array.isArray(req.body.services) ? req.body.services : draft.services;
  });
  res.json(store.services);
}));

app.put('/api/admin/schedule', requireAdmin, asyncRoute(async (req, res) => {
  const store = await updateStore((draft) => {
    draft.schedule = { ...draft.schedule, ...req.body.schedule };
  });
  res.json(store.schedule);
}));

app.patch('/api/admin/appointments/:id', requireAdmin, asyncRoute(async (req, res) => {
  const store = await updateStore((draft) => {
    const appointment = draft.appointments.find((item) => item.id === req.params.id);
    if (appointment) {
      appointment.status = req.body.status || appointment.status;
      if (appointment.status === 'cancelled') {
        appointment.cancelledBy = 'admin';
        appointment.cancelledAt = new Date().toISOString();
      }
    }
  });
  res.json(store.appointments.map((appointment) => enrichAppointment(store, appointment)));
}));

app.post('/api/admin/upload', requireAdmin, upload.single('file'), asyncRoute(async (req, res) => {
  res.status(201).json({ url: await saveUpload(req.file) });
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: '\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u043e\u0448\u0438\u0431\u043a\u0430' });
});

export default app;
