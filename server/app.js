import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { getRequestUser, isAdminUser, requireAdmin } from './auth.js';
import { findService, getAvailableSlots, getMonthAvailability } from './availability.js';
import { makeId, readStore, updateStore } from './store.js';
import { notifyAdminAboutAppointment } from './bot.js';
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

app.get('/api/me', (req, res) => {
  const user = getRequestUser(req);
  res.json({ user, isAdmin: isAdminUser(user) });
});

app.get('/api/public/profile', asyncRoute(async (_req, res) => {
  res.json(publicPayload(await readStore()));
}));

app.get('/api/public/availability', asyncRoute(async (req, res) => {
  const store = await readStore();
  const serviceId = String(req.query.serviceId || '');
  const month = String(req.query.month || '');
  const match = month.match(/^(\d{4})-(\d{2})$/);

  if (!findService(store, serviceId)) {
    return res.status(404).json({ error: '\u0423\u0441\u043b\u0443\u0433\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430' });
  }

  if (!match) {
    return res.status(400).json({ error: '\u041d\u0443\u0436\u0435\u043d month \u0432 \u0444\u043e\u0440\u043c\u0430\u0442\u0435 YYYY-MM' });
  }

  res.json({ days: getMonthAvailability(store, Number(match[1]), Number(match[2]), serviceId) });
}));

app.get('/api/public/slots', asyncRoute(async (req, res) => {
  const store = await readStore();
  const serviceId = String(req.query.serviceId || '');
  const date = String(req.query.date || '');

  if (!findService(store, serviceId)) {
    return res.status(404).json({ error: '\u0423\u0441\u043b\u0443\u0433\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430' });
  }

  res.json({ slots: getAvailableSlots(store, date, serviceId) });
}));

app.post('/api/appointments', asyncRoute(async (req, res) => {
  const store = await readStore();
  const user = getRequestUser(req) || req.body.user || {};
  const { serviceId, date, time } = req.body;
  const found = findService(store, serviceId);

  if (!found) {
    return res.status(404).json({ error: '\u0423\u0441\u043b\u0443\u0433\u0430 \u043d\u0435 \u043d\u0430\u0439\u0434\u0435\u043d\u0430' });
  }

  if (!getAvailableSlots(store, date, serviceId).includes(time)) {
    return res.status(409).json({ error: '\u042d\u0442\u043e \u0432\u0440\u0435\u043c\u044f \u0443\u0436\u0435 \u0437\u0430\u043d\u044f\u0442\u043e \u0438\u043b\u0438 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e' });
  }

  let appointment;
  await updateStore((draft) => {
    appointment = {
      id: makeId('apt'),
      serviceId,
      date,
      time,
      user,
      status: 'active',
      createdAt: new Date().toISOString()
    };
    draft.appointments.push(appointment);
  });

  await notifyAdminAboutAppointment(appointment).catch(() => {});
  res.status(201).json({ appointment });
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
      const found = findService(store, appointment.serviceId);
      const review = store.reviews.find((item) => item.appointmentId === appointment.id);
      return {
        ...appointment,
        service: found?.service || null,
        category: found?.category ? { id: found.category.id, title: found.category.title } : null,
        review: review || null
      };
    })
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

  res.json({ appointments });
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

app.get('/api/admin/dashboard', requireAdmin, asyncRoute(async (_req, res) => {
  res.json(await readStore());
}));

app.put('/api/admin/profile', requireAdmin, asyncRoute(async (req, res) => {
  const profile = req.body.profile;
  const store = await updateStore((draft) => {
    draft.profile = {
      ...draft.profile,
      ...profile,
      socials: Array.isArray(profile.socials) ? profile.socials.slice(0, 8) : draft.profile.socials,
      gallery: Array.isArray(profile.gallery) ? profile.gallery.slice(0, 3) : draft.profile.gallery
    };
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
    if (appointment) appointment.status = req.body.status || appointment.status;
  });
  res.json(store.appointments);
}));

app.post('/api/admin/upload', requireAdmin, upload.single('file'), asyncRoute(async (req, res) => {
  res.status(201).json({ url: await saveUpload(req.file) });
}));

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: '\u0412\u043d\u0443\u0442\u0440\u0435\u043d\u043d\u044f\u044f \u043e\u0448\u0438\u0431\u043a\u0430' });
});

export default app;
