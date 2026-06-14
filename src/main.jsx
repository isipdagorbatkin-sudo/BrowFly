import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Instagram,
  Link as LinkIcon,
  Music2,
  Plus,
  Save,
  Send,
  Settings,
  Star,
  Trash2,
  Upload,
  UserRound,
  X
} from 'lucide-react';
import './styles.css';

const tg = window.Telegram?.WebApp;
const adminNames = new Set(['m_lova_yulia', 'ivyheroin', 'lash_yulia_m']);

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function getDevUser() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('admin') === '1') return { id: 1, first_name: 'Yulia', username: 'm_lova_yulia' };
  return { id: 2, first_name: 'Guest', username: 'guest' };
}

function getUser() {
  return tg?.initDataUnsafe?.user || getDevUser();
}

function encodeDevUser(user) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(user))));
}

async function api(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
  if (!tg?.initData) headers['x-dev-user'] = encodeDevUser(getUser());

  const response = await fetch(path, { ...options, headers, cache: 'no-store' });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(data?.error || 'Ошибка запроса');
  return data;
}

async function uploadFile(file) {
  const form = new FormData();
  form.append('file', file);
  const headers = {};
  if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
  if (!tg?.initData) headers['x-dev-user'] = encodeDevUser(getUser());
  const response = await fetch('/api/admin/upload', { method: 'POST', headers, body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Не удалось загрузить файл');
  return data.url;
}

async function uploadReferenceFile(file) {
  const form = new FormData();
  form.append('file', file);
  const headers = {};
  if (tg?.initData) headers['x-telegram-init-data'] = tg.initData;
  if (!tg?.initData) headers['x-dev-user'] = encodeDevUser(getUser());
  const response = await fetch('/api/uploads/reference', { method: 'POST', headers, body: form });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error || 'Не удалось загрузить референс');
  return data.url;
}

function money(value) {
  return `${Number(value || 0).toLocaleString('ru-RU')} ₽`;
}

function minutes(value) {
  const hours = Math.floor(Number(value || 0) / 60);
  const mins = Number(value || 0) % 60;
  if (hours && mins) return `${hours} ч ${mins} м`;
  if (hours) return `${hours} ч`;
  return `${mins} м`;
}

function serviceSummary(services = []) {
  return {
    totalPrice: services.reduce((sum, service) => sum + Number(service.price || 0), 0),
    totalDurationMinutes: services.reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0),
    title: services.map((service) => service.title).filter(Boolean).join(', ')
  };
}

function appointmentServices(appointment) {
  if (appointment.services?.length) return appointment.services;
  return appointment.service ? [appointment.service] : [];
}

function appointmentTitle(appointment) {
  return appointmentServices(appointment).map((service) => service.title).filter(Boolean).join(', ') || 'Услуга';
}

function appointmentStatusLabel(status) {
  if (status === 'cancelled') return 'Отменена';
  if (status === 'completed') return 'Завершена';
  return 'Активна';
}

function monthLabel(date) {
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function ymd(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function mondayOf(date) {
  const next = new Date(date);
  const offset = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - offset);
  return next;
}

function shortDateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
}

function moscowDateTime(date, time) {
  return new Date(`${date}T${time}:00+03:00`);
}

function fullDateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('ru-RU', {
    weekday: 'short',
    day: 'numeric',
    month: 'long'
  });
}

const slotHours = Array.from({ length: 15 }, (_, index) => String(index + 8).padStart(2, '0'));
const slotMinutes = ['00', '15', '30', '45'];

function detectSocialType(social = {}) {
  const key = `${social.type || ''} ${social.label || ''} ${social.url || ''}`.toLowerCase();
  if (key.includes('instagram.com') || key.includes('instagr.am') || key.includes('instagram') || key.includes('инст')) return 'instagram';
  if (key.includes('vk.com') || key.includes('vk.ru') || key.includes('vkontakte') || key.includes('вк')) return 'vk';
  if (key.includes('tiktok.com') || key.includes('tik') || key.includes('тикток')) return 'tiktok';
  if (key.includes('t.me') || key.includes('telegram.me') || key.includes('telegram') || key.includes('tg') || key.includes('телеграм')) return 'telegram';
  return 'link';
}

function SocialIcon({ social }) {
  const key = detectSocialType(social);
  if (key.includes('instagram')) return <Instagram size={17} />;
  if (key.includes('vk')) return <span className="vk-mark">vk</span>;
  if (key.includes('tik') || key.includes('music')) return <Music2 size={17} />;
  if (key.includes('telegram')) return <Send size={18} />;
  return <LinkIcon size={17} />;
}

function socialHandle(social) {
  if (detectSocialType(social) !== 'telegram') return '';
  if (social.username) return `@${String(social.username).replace('@', '').trim()}`;
  const raw = String(social.url || '').trim();
  const match = raw.match(/(?:t\.me|telegram\.me)\/([^/?#]+)/i);
  const username = (match?.[1] || raw.replace(/^@/, '')).trim();
  if (!username || username.startsWith('http')) return '';
  return `@${username}`;
}

function telegramHandleUrl(social) {
  const handle = socialHandle(social).replace('@', '');
  return handle ? `https://t.me/${handle}` : social.url;
}

function App() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('public');
  const [publicTab, setPublicTab] = useState('profile');
  const [selected, setSelected] = useState([]);
  const [booking, setBooking] = useState(false);
  const [toast, setToast] = useState('');
  const [lightbox, setLightbox] = useState(null);
  const user = getUser();
  const isAdmin = adminNames.has(String(user?.username || '').replace('@', '').toLowerCase());

  useEffect(() => {
    tg?.ready();
    tg?.expand();
    load();
  }, []);

  async function load() {
    const profile = await api('/api/public/profile');
    setData(profile);
  }

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(''), 1700);
  }

  if (!data) return <div className="boot">Загрузка...</div>;

  return (
    <div className="app-shell">
      <div className="background" style={{ backgroundImage: `url(${data.profile.backgroundUrl || data.profile.avatarUrl || data.profile.gallery?.[0] || ''})` }} />
      {isAdmin && (
        <button
          className="settings-button"
          onClick={() => {
            setMode(mode === 'admin' ? 'public' : 'admin');
            setBooking(false);
            setPublicTab('profile');
          }}
          aria-label={mode === 'admin' ? 'Закрыть настройки' : 'Настройки'}
        >
          {mode === 'admin' ? <X size={23} /> : <Settings size={22} />}
        </button>
      )}

      {mode === 'admin' && isAdmin ? (
        <AdminPanel data={data} reload={load} showToast={showToast} openImage={setLightbox} />
      ) : booking && selected.length > 0 ? (
        <BookingFlow
          selected={selected}
          openImage={setLightbox}
          onBack={() => setBooking(false)}
          onBooked={async () => {
            setBooking(false);
            setSelected([]);
            setPublicTab('appointments');
            await load();
          }}
          showToast={showToast}
        />
      ) : (
        <>
          <PublicTabs active={publicTab} setActive={setPublicTab} />
          {publicTab === 'profile' ? (
            <PublicProfile
              data={data}
              selected={selected}
              setSelected={setSelected}
              onContinue={() => setBooking(true)}
              openImage={setLightbox}
              showToast={showToast}
            />
          ) : publicTab === 'reviews' ? (
            <PublicReviews data={data} openImage={setLightbox} />
          ) : (
            <MyAppointments data={data} reload={load} showToast={showToast} openImage={setLightbox} />
          )}
        </>
      )}

      {lightbox && (
        <button className="image-lightbox" onClick={() => setLightbox(null)} aria-label="Закрыть фото">
          <img src={lightbox.src} alt={lightbox.alt || 'Фото'} />
          <span><X size={22} /></span>
        </button>
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function PublicProfile({ data, selected, setSelected, onContinue, openImage, showToast }) {
  const { profile, rating, services } = data;
  const summary = serviceSummary(selected);
  const socials = (profile.socials || []).filter((social) => social.url && social.label);
  const hasProfile = Boolean(
    profile.name ||
    profile.title ||
    profile.avatarUrl ||
    profile.address ||
    profile.description ||
    socials.length ||
    profile.gallery?.length
  );

  async function copyAddress() {
    if (!profile.address) return;
    await navigator.clipboard?.writeText(profile.address);
    showToast('Адрес скопирован!');
  }

  return (
    <>
      <main className="content">
        <section className="hero glass">
          <div className="avatar">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt={profile.name || 'Мастер'} onClick={() => openImage({ src: profile.avatarUrl, alt: profile.name || 'Мастер' })} />
            ) : <UserRound size={54} />}
          </div>
          {hasProfile ? (
            <>
              {profile.name && <h1>{profile.name}</h1>}
              {profile.title && <p className="subtitle">{profile.title}</p>}

              {socials.length > 0 && (
                <div className="socials">
                  {socials.map((social) => (
                    detectSocialType(social) === 'telegram' ? (
                      <div className="social-link telegram-social" key={social.id}>
                        <a href={social.url} target="_blank" rel="noreferrer" aria-label={social.label || 'Telegram'}>
                          <SocialIcon social={social} />
                        </a>
                        {socialHandle(social) && (
                          <a className="telegram-handle" href={telegramHandleUrl(social)} target="_blank" rel="noreferrer">
                            {socialHandle(social)}
                          </a>
                        )}
                      </div>
                    ) : (
                      <a key={social.id} href={social.url} target="_blank" rel="noreferrer" aria-label={social.label}>
                        <SocialIcon social={social} />
                      </a>
                    )
                  ))}
                </div>
              )}

              {rating.count > 0 && (
                <div className="rating-pill">
                  <Star size={20} fill="#ffd84a" color="#ffd84a" />
                  <strong>{rating.average}</strong>
                  <span>{rating.count} оценок</span>
                </div>
              )}

              {profile.address && (
                <button className="address" onClick={copyAddress}>
                  <Copy size={17} />
                  <span>{profile.address}</span>
                </button>
              )}

              {profile.description && <p className="description">{profile.description}</p>}
            </>
          ) : (
            <div className="empty-profile">
              <h1>Профиль мастера</h1>
              <p>Информация появится после заполнения в настройках.</p>
            </div>
          )}
        </section>

        {profile.gallery?.length > 0 && (
          <section className="gallery-row">
            {profile.gallery.slice(0, 3).map((src) => (
              <img key={src} src={src} alt="Работа мастера" onClick={() => openImage({ src, alt: 'Работа мастера' })} />
            ))}
          </section>
        )}

        <section className="services">
          {services.length > 0 ? (
            services.map((category, index) => (
              <ServiceCategory
                key={category.id}
                category={category}
                defaultOpen={index === 0}
                selected={selected}
                setSelected={setSelected}
                openImage={openImage}
              />
            ))
          ) : (
            <div className="empty-services glass">
              <h2>Услуги пока не добавлены</h2>
              <p>Мастер скоро заполнит список услуг и расписание.</p>
            </div>
          )}
        </section>
      </main>

      {selected.length > 0 && (
        <div className="bottom-bar">
          <div>
            <span>Итого</span>
            <strong>{money(summary.totalPrice)}</strong>
            <em>{minutes(summary.totalDurationMinutes)}</em>
          </div>
          <button onClick={onContinue}>Продолжить →</button>
        </div>
      )}
    </>
  );
}

function ServiceCategory({ category, defaultOpen, selected, setSelected, openImage }) {
  const [open, setOpen] = useState(defaultOpen);
  function toggleService(service) {
    setSelected((current) => (
      current.some((item) => item.id === service.id)
        ? current.filter((item) => item.id !== service.id)
        : [...current, service]
    ));
  }

  return (
    <article className="category">
      <button className="category-head glass" onClick={() => setOpen(!open)}>
        <span>{category.title}</span>
        <ChevronDown className={open ? 'rotated' : ''} />
      </button>
      {open && (
        <div className="category-items">
          {category.items.map((item) => {
            const photos = (item.photos || []).filter(Boolean).slice(0, 3);
            const isSelected = selected.some((service) => service.id === item.id);

            return (
              <div className="service-card glass" key={item.id}>
                <h3>{item.title}</h3>
                {item.description && <p>{item.description}</p>}
                {photos.length > 0 && (
                  <div className="photo-grid">
                    {photos.map((photo) => (
                      <img key={photo} src={photo} alt={item.title} onClick={() => openImage({ src: photo, alt: item.title })} />
                    ))}
                  </div>
                )}
                <div className="service-actions">
                  <span>{minutes(item.durationMinutes)}</span>
                  <strong>{money(item.price)}</strong>
                  <button
                  className={isSelected ? 'selected' : ''}
                  onClick={() => toggleService(item)}
                >
                    {isSelected ? 'Выбрано' : 'Записаться'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </article>
  );
}

function BookingFlow({ selected, onBack, onBooked, openImage, showToast }) {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState([]);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [time, setTime] = useState('');
  const [comment, setComment] = useState('');
  const [referenceUrl, setReferenceUrl] = useState('');
  const [done, setDone] = useState(null);
  const summary = serviceSummary(selected);
  const serviceIds = selected.map((service) => service.id);
  const serviceQuery = encodeURIComponent(serviceIds.join(','));

  useEffect(() => {
    loadMonth();
  }, [month, serviceQuery]);

  useEffect(() => {
    if (date) loadSlots(date);
  }, [date]);

  async function loadMonth() {
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    const result = await api(`/api/public/availability?serviceIds=${serviceQuery}&month=${key}`);
    setDays(result.days);
    const firstAvailable = result.days.find((day) => day.available);
    setDate((current) => (current && result.days.some((day) => day.date === current && day.available) ? current : firstAvailable?.date || ''));
  }

  async function loadSlots(nextDate) {
    const result = await api(`/api/public/slots?serviceIds=${serviceQuery}&date=${nextDate}`);
    setSlots(result.slots);
    setTime('');
  }

  async function book() {
    const result = await api('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ serviceIds, date, time, comment, referenceUrl, user: getUser() })
    });
    setDone(result.appointment);
    showToast('Запись создана!');
  }

  async function uploadReference() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const url = await uploadReferenceFile(file);
      setReferenceUrl(url);
      showToast('Референс загружен');
    };
    input.click();
  }

  const calendarCells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const cells = Array.from({ length: mondayOffset }, () => null);
    return [...cells, ...days];
  }, [days, month]);

  if (done) {
    return <BookingCreated appointment={done} selected={selected} onBack={onBack} onBooked={onBooked} />;
  }

  return (
    <>
      <main className="content booking-content">
        <button className="back-to-profile glass" onClick={onBack}>
          <ChevronLeft size={18} />
          Назад
        </button>
        <section className="calendar-card glass">
          <div className="calendar-top">
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Предыдущий месяц"><ChevronLeft /></button>
            <h2>{monthLabel(month)}</h2>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Следующий месяц">
              <ChevronRight />
            </button>
          </div>
          <div className="weekdays">{['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'].map((day) => <span key={day}>{day}</span>)}</div>
          <div className="calendar-grid">
            {calendarCells.map((day, index) => (
              day ? (
                <button
                  key={day.date}
                  disabled={!day.available}
                  className={date === day.date ? 'active' : day.available ? 'available' : ''}
                  onClick={() => setDate(day.date)}
                >
                  {Number(day.date.slice(-2))}
                </button>
              ) : <span key={`blank-${index}`} />
            ))}
          </div>
        </section>

        <section className="slots-card glass">
          <SlotGroup title="Утро" slots={slots.filter((slot) => Number(slot.slice(0, 2)) < 12)} time={time} setTime={setTime} />
          <SlotGroup title="День" slots={slots.filter((slot) => Number(slot.slice(0, 2)) >= 12 && Number(slot.slice(0, 2)) < 18)} time={time} setTime={setTime} />
          <SlotGroup title="Вечер" slots={slots.filter((slot) => Number(slot.slice(0, 2)) >= 18)} time={time} setTime={setTime} />
        </section>
        <section className="slots-card glass">
          <label className="booking-comment">
            Комментарий к записи
            <span>Например, загрузите референс и напишите пожелания к процедуре.</span>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={500}
              placeholder="Например: хочу натуральный эффект, есть чувствительность, буду на 5 минут позже"
            />
          </label>
          <div className="reference-upload">
            {referenceUrl ? <img src={referenceUrl} alt="Референс" onClick={() => openImage({ src: referenceUrl, alt: 'Референс' })} /> : <div><Upload size={22} /> Референс</div>}
            <button className="secondary" onClick={uploadReference}>
              <Upload size={16} /> {referenceUrl ? 'Заменить фото' : 'Загрузить фото'}
            </button>
          </div>
        </section>
      </main>
      <div className="bottom-bar">
        <div>
          <span>Итого</span>
          <strong>{money(summary.totalPrice)}</strong>
          <em>{minutes(summary.totalDurationMinutes)}</em>
        </div>
        <button disabled={!date || !time} onClick={book}>
          {date ? `Записаться ${date.slice(8, 10)}.${date.slice(5, 7)}` : 'Записаться'}
        </button>
      </div>
    </>
  );
}

function SlotGroup({ title, slots, time, setTime }) {
  return (
    <div className="slot-group">
      <h3><Clock size={16} /> {title}</h3>
      <div className="slot-list">
        {slots.length ? slots.map((slot) => (
          <button key={slot} className={time === slot ? 'active' : ''} onClick={() => setTime(slot)}>
            {slot}
          </button>
        )) : <span className="empty-slot">Нет времени</span>}
      </div>
    </div>
  );
}

function BookingCreated({ appointment, selected, onBack, onBooked }) {
  const summary = serviceSummary(selected);
  return (
    <main className="content">
      <section className="done-card glass">
        <CalendarDays size={36} />
        <h2>Запись создана!</h2>
        <p>{summary.title}, {appointment.date} в {appointment.time}</p>
        <p>{money(summary.totalPrice)} · {minutes(summary.totalDurationMinutes)}</p>
        <p>Посмотреть ее можно во вкладке «Мои записи».</p>
        <button className="primary" onClick={onBooked}>Мои записи</button>
        <button className="secondary" onClick={onBack}>Вернуться на главную</button>
      </section>
    </main>
  );
}

function MyAppointments({ data, reload, showToast, openImage }) {
  const [appointments, setAppointments] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showArchive, setShowArchive] = useState(false);

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    setLoading(true);
    const result = await api('/api/my/appointments');
    setAppointments(result.appointments || []);
    setLoading(false);
  }

  async function loadArchive() {
    setLoading(true);
    const result = await api('/api/my/archive');
    setAppointments(result.appointments || []);
    setLoading(false);
  }

  async function refreshAll() {
    if (showArchive) {
      await loadArchive();
    } else {
      await loadAppointments();
    }
    await reload();
  }

  function openArchive() {
    setShowArchive(true);
    loadArchive();
  }

  function closeArchive() {
    setShowArchive(false);
    loadAppointments();
  }

  if (active) {
    return (
      <AppointmentDetails
        appointment={active}
        onBack={() => setActive(null)}
        onReviewed={refreshAll}
        onCancelled={(appointment) => {
          setActive(appointment);
          refreshAll();
        }}
        openImage={openImage}
        showToast={showToast}
      />
    );
  }

  return (
    <main className="content">
      <section className="admin-card glass">
        <div className="archive-header">
          <h2>{showArchive ? 'Архив' : 'Мои записи'}</h2>
          {showArchive ? (
            <button className="secondary small" onClick={closeArchive}>← Мои записи</button>
          ) : (
            <button className="secondary small" onClick={openArchive}>Архив</button>
          )}
        </div>
        {loading && <p className="muted">Загрузка...</p>}
        {!loading && appointments.length === 0 && <p className="muted">{showArchive ? 'В архиве пока нет записей.' : 'Записей пока нет.'}</p>}
        {appointments.map((appointment) => (
          <button className="my-appointment" key={appointment.id} onClick={() => setActive(appointment)}>
            <strong>{appointmentTitle(appointment)}</strong>
            <span>{appointment.date} в {appointment.time}</span>
            <em>{appointment.review ? 'Отзыв оставлен' : appointmentStatusLabel(appointment.status)}</em>
          </button>
        ))}
      </section>
    </main>
  );
}

function AppointmentDetails({ appointment, onBack, onReviewed, onCancelled, openImage, showToast }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [reviewPhotoUrl, setReviewPhotoUrl] = useState('');
  const [review, setReview] = useState(appointment.review);
  const isCancelled = appointment.status === 'cancelled';
  const isCompleted = appointment.status === 'completed';
  const services = appointmentServices(appointment);
  const totalPrice = appointment.totalPrice || services.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const totalDuration = appointment.totalDurationMinutes || services.reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0);

  async function sendReview() {
    const result = await api('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ appointmentId: appointment.id, rating, text, photoUrl: reviewPhotoUrl, user: getUser() })
    });
    setReview(result.review);
    await onReviewed();
    showToast('Спасибо за отзыв!');
  }

  async function cancelAppointment() {
    const result = await api(`/api/my/appointments/${appointment.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'cancelled', user: getUser() })
    });
    showToast('Запись отменена');
    onCancelled(result.appointment);
  }

  async function archiveAppointment() {
    await api(`/api/my/appointments/${appointment.id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ user: getUser() })
    });
    showToast('Запись в архиве');
    onBack();
  }

  async function uploadReviewPhoto() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      if (!input.files?.[0]) return;
      const url = await uploadReferenceFile(input.files[0]);
      setReviewPhotoUrl(url);
      showToast('Фото к отзыву загружено');
    };
    input.click();
  }

  return (
    <main className="content">
      <section className="done-card glass">
        <button className="back-to-profile glass" onClick={onBack}>
          <ChevronLeft size={18} />
          Назад
        </button>
        <CalendarDays size={34} />
        <h2>{appointmentTitle(appointment)}</h2>
        <p>{appointment.date} в {appointment.time}</p>
        {totalPrice || totalDuration ? <p>{money(totalPrice)} · {minutes(totalDuration)}</p> : null}
        {appointment.comment && (
          <div className="appointment-comment">
            <strong>Комментарий</strong>
            <p>{appointment.comment}</p>
          </div>
        )}
        {appointment.referenceUrl && (
          <div className="appointment-comment">
            <strong>Референс</strong>
            <img className="appointment-reference" src={appointment.referenceUrl} alt="Референс к записи" onClick={() => openImage({ src: appointment.referenceUrl, alt: 'Референс к записи' })} />
          </div>
        )}
        {appointment.confirmedAt && <p className="confirm-note">Запись подтверждена ✅</p>}
        {isCancelled && <p className="muted">Эта запись отменена.</p>}
        {isCompleted && !review && <p className="review-invite">Оставьте пожалуйста отзыв ✨</p>}
        {!isCancelled && !isCompleted && (
          <button className="secondary danger" onClick={cancelAppointment}>Отменить запись</button>
        )}
        <button className="secondary" onClick={archiveAppointment}>В архив</button>
        {review ? (
          <div className="review-summary">
            <strong>Твоя оценка: {review.rating}/5</strong>
            {review.text && <p>{review.text}</p>}
            {review.photoUrl && (
              <img className="review-photo" src={review.photoUrl} alt="Фото к отзыву" onClick={() => openImage({ src: review.photoUrl, alt: 'Фото к отзыву' })} />
            )}
          </div>
        ) : isCompleted ? (
          <>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} aria-label={`${star} звезд`}>
                  <Star fill={star <= rating ? '#ffd84a' : 'transparent'} color="#ffd84a" />
                </button>
              ))}
            </div>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Отзыв после визита можно оставить здесь" />
            <div className="review-photo-uploader">
              {reviewPhotoUrl ? (
                <img src={reviewPhotoUrl} alt="Фото к отзыву" onClick={() => openImage({ src: reviewPhotoUrl, alt: 'Фото к отзыву' })} />
              ) : (
                <div><Upload size={22} /> Фото к отзыву</div>
              )}
              <div>
                <button className="secondary" onClick={uploadReviewPhoto}>
                  <Upload size={16} /> {reviewPhotoUrl ? 'Заменить фото' : 'Загрузить фото'}
                </button>
                {reviewPhotoUrl && (
                  <button className="secondary danger" onClick={() => setReviewPhotoUrl('')}>
                    <Trash2 size={16} /> Удалить фото
                  </button>
                )}
              </div>
            </div>
            <button className="primary" onClick={sendReview}>Оставить отзыв</button>
          </>
        ) : !isCancelled ? (
          <p className="muted">После визита Юлия отметит запись завершенной, и здесь можно будет оставить отзыв.</p>
        ) : null}
      </section>
    </main>
  );
}

function AdminPanel({ data, reload, showToast, openImage }) {
  const [tab, setTab] = useState('profile');
  const [store, setStore] = useState(null);

  useEffect(() => {
    api('/api/admin/dashboard').then(setStore);
  }, []);

  async function refresh() {
    const next = await api('/api/admin/dashboard');
    setStore(next);
    await reload();
  }

  if (!store) return <div className="boot">Админка загружается...</div>;

  return (
    <main className="content admin">
      <section className="admin-head glass">
        <h1>Админка Юльки</h1>
        <div className="tabs">
          {[
            ['profile', 'Профиль'],
            ['appointments', 'Записи'],
            ['manual', 'Мои записи'],
            ['reviews', 'Отзывы'],
            ['services', 'Услуги'],
            ['schedule', 'График']
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </section>

      {tab === 'profile' && <AdminProfile store={store} refresh={refresh} showToast={showToast} openImage={openImage} />}
      {tab === 'services' && <AdminServices store={store} refresh={refresh} showToast={showToast} openImage={openImage} />}
      {tab === 'schedule' && <AdminSchedule store={store} refresh={refresh} showToast={showToast} />}
      {tab === 'appointments' && <AdminAppointments store={store} refresh={refresh} showToast={showToast} data={data} />}
      {tab === 'manual' && <AdminManualAppointment store={store} refresh={refresh} showToast={showToast} />}
      {tab === 'reviews' && <AdminReviews store={store} refresh={refresh} showToast={showToast} openImage={openImage} />}
    </main>
  );
}

function AdminProfile({ store, refresh, showToast, openImage }) {
  const [profile, setProfile] = useState(store.profile);

  async function save() {
    await api('/api/admin/profile', { method: 'PUT', body: JSON.stringify({ profile }) });
    showToast('Профиль сохранен');
    refresh();
  }

  async function upload(target, index) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const url = await uploadFile(input.files[0]);
      if (target === 'avatar') {
        setProfile({ ...profile, avatarUrl: url });
        showToast('Аватар загружен. Нажми “Сохранить”.');
      }
      if (target === 'background') {
        setProfile({ ...profile, backgroundUrl: url });
        showToast('Фон загружен. Нажми “Сохранить”.');
      }
      if (target === 'gallery') {
        const gallery = [...(profile.gallery || [])];
        gallery[index] = url;
        setProfile({ ...profile, gallery: gallery.slice(0, 3) });
        showToast('Фото загружено. Нажми “Сохранить”.');
      }
    };
    input.click();
  }

  function updateProfileField(field, value) {
    setProfile({ ...profile, [field]: value });
  }

  return (
    <section className="admin-card glass">
      <label className="profile-field">Имя
        <div>
          <input value={profile.name} onChange={(event) => updateProfileField('name', event.target.value)} />
          {profile.name && <button onClick={() => updateProfileField('name', '')}><Trash2 size={16} /></button>}
        </div>
      </label>
      <label className="profile-field">Заголовок
        <div>
          <input value={profile.title} onChange={(event) => updateProfileField('title', event.target.value)} />
          {profile.title && <button onClick={() => updateProfileField('title', '')}><Trash2 size={16} /></button>}
        </div>
      </label>
      <label className="profile-field">Адрес
        <div>
          <input value={profile.address} onChange={(event) => updateProfileField('address', event.target.value)} />
          {profile.address && <button onClick={() => updateProfileField('address', '')}><Trash2 size={16} /></button>}
        </div>
      </label>
      <label className="profile-field">Описание
        <div>
          <textarea value={profile.description} onChange={(event) => updateProfileField('description', event.target.value)} />
          {profile.description && <button onClick={() => updateProfileField('description', '')}><Trash2 size={16} /></button>}
        </div>
      </label>
      <button className="secondary" onClick={() => upload('avatar')}><Upload size={17} /> Загрузить аватар</button>
      {profile.avatarUrl && (
        <div className="admin-media-preview avatar-preview">
          <img src={profile.avatarUrl} alt="Текущий аватар" onClick={() => openImage({ src: profile.avatarUrl, alt: 'Текущий аватар' })} />
          <div>
            <strong>Текущий аватар</strong>
            <button onClick={() => setProfile({ ...profile, avatarUrl: '' })}><Trash2 size={16} /> Удалить</button>
          </div>
        </div>
      )}
      <button className="secondary" onClick={() => upload('background')}><Upload size={17} /> Загрузить фон</button>
      {profile.backgroundUrl && (
        <div className="admin-media-preview background-preview">
          <img src={profile.backgroundUrl} alt="Фон профиля" onClick={() => openImage({ src: profile.backgroundUrl, alt: 'Фон профиля' })} />
          <div>
            <strong>Текущий фон</strong>
            <button onClick={() => setProfile({ ...profile, backgroundUrl: '' })}><Trash2 size={16} /> Удалить</button>
          </div>
        </div>
      )}
      <div className="admin-gallery">
        {[0, 1, 2].map((index) => (
          <div className="admin-gallery-item" key={index}>
            <button onClick={() => (profile.gallery?.[index] ? openImage({ src: profile.gallery[index], alt: `Фото ${index + 1}` }) : upload('gallery', index))}>
              {profile.gallery?.[index] ? <img src={profile.gallery[index]} alt={`Фото ${index + 1}`} /> : <Plus />}
            </button>
            {profile.gallery?.[index] && (
              <button
                className="gallery-delete"
                onClick={() => {
                  const gallery = [...(profile.gallery || [])];
                  gallery[index] = '';
                  setProfile({ ...profile, gallery: gallery.filter(Boolean).slice(0, 3) });
                }}
              >
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ))}
      </div>
      <h3>Соцсети</h3>
      {(profile.socials || []).map((social, index) => (
        <div className="social-admin-row" key={social.id}>
          <div className="inline-fields">
            <input value={social.label} placeholder="Название" onChange={(event) => {
              const socials = [...profile.socials];
              socials[index] = { ...social, label: event.target.value, type: event.target.value };
              setProfile({ ...profile, socials });
            }} />
            <input value={social.url} placeholder="Ссылка на ТГК или соцсеть" onChange={(event) => {
              const socials = [...profile.socials];
              socials[index] = { ...social, url: event.target.value };
              setProfile({ ...profile, socials });
            }} />
            <button onClick={() => setProfile({ ...profile, socials: profile.socials.filter((_, i) => i !== index) })}><Trash2 size={16} /></button>
          </div>
          <input
            value={social.username || ''}
            placeholder="Юзернейм для чата, например @julia_beautylashes"
            onChange={(event) => {
              const socials = [...profile.socials];
              socials[index] = { ...social, username: event.target.value };
              setProfile({ ...profile, socials });
            }}
          />
        </div>
      ))}
      <button className="secondary" onClick={() => setProfile({ ...profile, socials: [...(profile.socials || []), { id: uid('soc'), label: 'Ссылка', type: 'link', url: '', username: '' }] })}>
        <Plus size={17} /> Добавить ссылку
      </button>
      <button className="primary" onClick={save}><Save size={18} /> Сохранить</button>
    </section>
  );
}

function AdminServices({ store, refresh, showToast, openImage }) {
  const [services, setServices] = useState(store.services);

  async function save(next = services) {
    await api('/api/admin/services', { method: 'PUT', body: JSON.stringify({ services: next }) });
    setServices(next);
    showToast('Услуги сохранены');
    refresh();
  }

  function updateCategory(index, patch) {
    const next = [...services];
    next[index] = { ...next[index], ...patch };
    setServices(next);
  }

  function updateItem(catIndex, itemIndex, patch) {
    const next = [...services];
    next[catIndex].items[itemIndex] = { ...next[catIndex].items[itemIndex], ...patch };
    setServices(next);
  }

  async function uploadPhoto(catIndex, itemIndex, photoIndex) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async () => {
      const url = await uploadFile(input.files[0]);
      const next = [...services];
      const photos = [...(next[catIndex].items[itemIndex].photos || [])];
      photos[photoIndex] = url;
      next[catIndex].items[itemIndex].photos = photos.slice(0, 3);
      setServices(next);
      showToast('Фото услуги загружено. Нажми “Сохранить услуги”.');
    };
    input.click();
  }

  return (
    <section className="admin-card glass">
      {services.map((category, catIndex) => (
        <div className="admin-category" key={category.id}>
          <label>Название категории
            <input value={category.title} onChange={(event) => updateCategory(catIndex, { title: event.target.value })} />
          </label>
          {category.items.map((item, itemIndex) => (
            <div className="admin-service" key={item.id}>
              <label>Название услуги
                <input value={item.title} onChange={(event) => updateItem(catIndex, itemIndex, { title: event.target.value })} />
              </label>
              <label>Описание услуги
                <textarea value={item.description} onChange={(event) => updateItem(catIndex, itemIndex, { description: event.target.value })} />
              </label>
              <div className="inline-fields">
                <label>Длительность, мин
                  <input type="number" value={item.durationMinutes} onChange={(event) => updateItem(catIndex, itemIndex, { durationMinutes: Number(event.target.value) })} />
                </label>
                <label>Цена, ₽
                  <input type="number" value={item.price} onChange={(event) => updateItem(catIndex, itemIndex, { price: Number(event.target.value) })} />
                </label>
                <button onClick={() => {
                  const next = [...services];
                  next[catIndex].items = next[catIndex].items.filter((_, i) => i !== itemIndex);
                  setServices(next);
                }}><Trash2 size={16} /></button>
              </div>
              <div className="admin-gallery">
                {[0, 1, 2].map((photoIndex) => (
                  <div className="admin-gallery-item" key={photoIndex}>
                    <button onClick={() => (item.photos?.[photoIndex] ? openImage({ src: item.photos[photoIndex], alt: item.title }) : uploadPhoto(catIndex, itemIndex, photoIndex))}>
                      {item.photos?.[photoIndex] ? <img src={item.photos[photoIndex]} alt="" /> : <Plus />}
                    </button>
                    {item.photos?.[photoIndex] && (
                      <button
                        className="gallery-delete"
                        onClick={() => {
                          const next = [...services];
                          const photos = [...(next[catIndex].items[itemIndex].photos || [])];
                          photos[photoIndex] = '';
                          next[catIndex].items[itemIndex].photos = photos.filter(Boolean).slice(0, 3);
                          setServices(next);
                          showToast('Фото удалено. Нажми “Сохранить услуги”.');
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button className="secondary" onClick={() => {
            const next = [...services];
            next[catIndex].items.push({ id: uid('svc'), title: 'Новая услуга', description: '', durationMinutes: 60, price: 0, photos: [] });
            setServices(next);
          }}><Plus size={17} /> Подуслуга</button>
        </div>
      ))}
      <button className="secondary" onClick={() => setServices([...services, { id: uid('cat'), title: 'Новая категория', description: '', items: [] }])}>
        <Plus size={17} /> Категория
      </button>
      <button className="primary" onClick={() => save()}><Save size={18} /> Сохранить услуги</button>
    </section>
  );
}

function AdminManualAppointment({ store, refresh, showToast }) {
  const allServices = useMemo(
    () => store.services.flatMap((category) => category.items.map((item) => ({ ...item, categoryTitle: category.title }))),
    [store.services]
  );
  const [selectedIds, setSelectedIds] = useState([]);
  const [date, setDate] = useState(ymd(new Date()));
  const [hour, setHour] = useState('10');
  const [minute, setMinute] = useState('00');
  const [clientName, setClientName] = useState('');
  const [clientSource, setClientSource] = useState('');
  const [clientContact, setClientContact] = useState('');
  const [comment, setComment] = useState('');
  const selectedServices = allServices.filter((service) => selectedIds.includes(service.id));
  const summary = serviceSummary(selectedServices);

  function toggleService(id) {
    setSelectedIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
  }

  async function createManualAppointment() {
    if (!selectedIds.length) {
      showToast('Выбери хотя бы одну услугу');
      return;
    }
    if (!clientName.trim()) {
      showToast('Укажи имя клиента');
      return;
    }

    try {
      await api('/api/admin/appointments', {
        method: 'POST',
        body: JSON.stringify({
          serviceIds: selectedIds,
          date,
          time: `${hour}:${minute}`,
          clientName,
          clientSource,
          clientContact,
          comment
        })
      });
      showToast('Запись добавлена');
      setClientName('');
      setClientSource('');
      setClientContact('');
      setComment('');
      setSelectedIds([]);
      await refresh();
    } catch (error) {
      showToast(error.message || 'Не получилось добавить запись');
    }
  }

  return (
    <section className="admin-card glass">
      <h2>Мои записи</h2>
      <p className="muted">Добавь клиента вручную, если он записался не через Telegram.</p>

      <div className="manual-service-list">
        {allServices.length === 0 && <p className="muted">Сначала добавь услуги во вкладке «Услуги».</p>}
        {allServices.map((service) => (
          <button
            type="button"
            key={service.id}
            className={selectedIds.includes(service.id) ? 'selected' : ''}
            onClick={() => toggleService(service.id)}
          >
            <span>{service.categoryTitle}</span>
            <strong>{service.title}</strong>
            <em>{money(service.price)} · {minutes(service.durationMinutes)}</em>
          </button>
        ))}
      </div>

      {selectedServices.length > 0 && (
        <div className="manual-summary">
          <strong>{summary.title}</strong>
          <span>{money(summary.totalPrice)} · {minutes(summary.totalDurationMinutes)}</span>
        </div>
      )}

      <label>Имя клиента
        <input value={clientName} onChange={(event) => setClientName(event.target.value)} placeholder="Например Светлана" />
      </label>
      <label>Из какой соцсети
        <input value={clientSource} onChange={(event) => setClientSource(event.target.value)} placeholder="Например VK, Instagram, WhatsApp" />
      </label>
      <label>Контакт клиента
        <input value={clientContact} onChange={(event) => setClientContact(event.target.value)} placeholder="@username, телефон или ссылка" />
      </label>

      <div className="manual-date-time">
        <label>Дата
          <input value={date} inputMode="numeric" onChange={(event) => setDate(event.target.value)} placeholder="2026-06-15" />
        </label>
        <label>Время
          <div className="time-picker">
            <select value={hour} onChange={(event) => setHour(event.target.value)} aria-label="Часы">
              {slotHours.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <span>:</span>
            <select value={minute} onChange={(event) => setMinute(event.target.value)} aria-label="Минуты">
              {slotMinutes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </label>
      </div>

      <label>Комментарий
        <textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Что важно помнить по этой записи" />
      </label>

      <button className="primary" onClick={createManualAppointment}>
        <Plus size={18} /> Добавить запись
      </button>
    </section>
  );
}

function AdminSchedule({ store, refresh, showToast }) {
  const [schedule, setSchedule] = useState(store.schedule);
  const [weekStart, setWeekStart] = useState(ymd(mondayOf(new Date())));
  const [slotDate, setSlotDate] = useState(ymd(new Date()));
  const [slotHour, setSlotHour] = useState('10');
  const [slotMinute, setSlotMinute] = useState('00');
  const [showWeekList, setShowWeekList] = useState(false);
  const dateSlots = schedule.dateSlots || {};
  const slotTime = `${slotHour}:${slotMinute}`;
  const weekDates = Array.from({ length: 7 }, (_, index) => ymd(addDays(new Date(`${weekStart}T00:00:00`), index)));
  const weekSlotRows = weekDates
    .map((date) => ({ date, slots: sortedSlots(date) }))
    .filter((item) => item.slots.length > 0);

  async function save(next = schedule) {
    await api('/api/admin/schedule', { method: 'PUT', body: JSON.stringify({ schedule: next }) });
    setSchedule(next);
    showToast('График сохранен');
    refresh();
  }

  function sortedSlots(date) {
    return [...(dateSlots[date] || [])].sort();
  }

  async function updateDateSlots(date, slots, persist = true) {
    const nextDateSlots = { ...dateSlots };
    const unique = [...new Set(slots)].filter(Boolean).sort();
    if (unique.length) {
      nextDateSlots[date] = unique;
    } else {
      delete nextDateSlots[date];
    }
    const nextSchedule = { ...schedule, dateSlots: nextDateSlots };
    setSchedule(nextSchedule);
    if (persist) await save(nextSchedule);
  }

  async function addSlot(date = slotDate, time = slotTime) {
    if (!date || !time) return;
    if (moscowDateTime(date, time) <= new Date()) {
      showToast('Нельзя добавить окошко в прошлом');
      return;
    }
    await updateDateSlots(date, [...(dateSlots[date] || []), time]);
  }

  return (
    <section className="admin-card glass">
      <h3>Свободные окошки на неделю</h3>
      <div className="inline-fields week-nav-fields">
        <button onClick={() => setWeekStart(ymd(addDays(new Date(`${weekStart}T00:00:00`), -7)))}><ChevronLeft size={16} /></button>
        <input className="compact-date-input" value={weekStart} inputMode="numeric" placeholder="2026-06-08" onChange={(event) => setWeekStart(ymd(mondayOf(new Date(`${event.target.value}T00:00:00`))))} />
        <button onClick={() => setWeekStart(ymd(addDays(new Date(`${weekStart}T00:00:00`), 7)))}><ChevronRight size={16} /></button>
      </div>

      <div className="inline-fields slot-add-fields">
        <input className="compact-date-input" value={slotDate} inputMode="numeric" placeholder="2026-06-12" onChange={(event) => setSlotDate(event.target.value)} />
        <div className="time-picker">
          <select value={slotHour} onChange={(event) => setSlotHour(event.target.value)} aria-label="Часы">
            {slotHours.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
          </select>
          <span>:</span>
          <select value={slotMinute} onChange={(event) => setSlotMinute(event.target.value)} aria-label="Минуты">
            {slotMinutes.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
          </select>
        </div>
        <button onClick={() => addSlot()}>Добавить окошко</button>
      </div>

      <div className="week-slots">
        {weekDates.map((date) => (
          <div className="week-day-card" key={date}>
            <div>
              <strong>{shortDateLabel(date)}</strong>
              <span>{date}</span>
            </div>
            <div className="chips">
              {sortedSlots(date).length ? sortedSlots(date).map((time) => (
                <button key={`${date}-${time}`} onClick={() => updateDateSlots(date, sortedSlots(date).filter((item) => item !== time))}>
                  {time} <X size={14} />
                </button>
              )) : <em>Окошек нет</em>}
            </div>
            <button className="secondary" onClick={() => {
              setSlotDate(date);
              addSlot(date, slotTime);
            }} disabled={moscowDateTime(date, slotTime) <= new Date()}>
              + {slotTime}
            </button>
          </div>
        ))}
      </div>

      <button className="secondary" onClick={() => setShowWeekList(!showWeekList)}>
        {showWeekList ? 'Скрыть список окошек' : 'Показать все окошки за неделю'}
      </button>

      {showWeekList && (
        <section className="free-slots-preview">
          <button className="free-slots-close" onClick={() => setShowWeekList(false)} aria-label="Закрыть список свободных окошек">
            <X size={20} />
          </button>
          <h3>Свободные окошки</h3>
          {weekSlotRows.length ? weekSlotRows.map(({ date, slots }) => (
            <div className="free-slots-day" key={date}>
              <strong>{fullDateLabel(date)}</strong>
              <div>
                {slots.map((time) => <span key={`${date}-${time}`}>{time}</span>)}
              </div>
            </div>
          )) : <p className="muted">На выбранной неделе окошек пока нет.</p>}
        </section>
      )}

      <button className="primary" onClick={() => save({ ...schedule, dateSlots })}><Save size={18} /> Сохранить график</button>
    </section>
  );
}

function AdminAppointments({ store, refresh, showToast }) {
  const [view, setView] = useState('active');
  const [showBusyList, setShowBusyList] = useState(false);
  const [archive, setArchive] = useState([]);
  const [loadingArchive, setLoadingArchive] = useState(false);

  const services = new Map(store.services.flatMap((category) => category.items.map((item) => [item.id, item])));
  function getAppointmentServices(appointment) {
    const ids = appointment.serviceIds?.length ? appointment.serviceIds : [appointment.serviceId].filter(Boolean);
    return ids.map((id) => services.get(id)).filter(Boolean);
  }

  async function cancel(id) {
    await api(`/api/admin/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'cancelled' }) });
    showToast('Запись отменена');
    refresh();
  }

  async function complete(id) {
    await api(`/api/admin/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'completed' }) });
    showToast('Запись завершена');
    refresh();
  }

  async function toggleArchive(id) {
    await api(`/api/admin/appointments/${id}/archive`, { method: 'PATCH' });
    showToast('Статус архива изменен');
    if (view === 'archive') {
      await loadArchive();
    }
    refresh();
  }

  async function loadArchive() {
    setLoadingArchive(true);
    const result = await api('/api/admin/archive');
    setArchive(result.appointments || []);
    setLoadingArchive(false);
  }

  function openArchive() {
    setView('archive');
    loadArchive();
  }

  function clientMessageUrl(appointment) {
    const user = appointment.user || {};
    const contact = String(appointment.clientContact || user.contact || '').trim();
    if (/^https?:\/\//i.test(contact)) return contact;
    if (contact.startsWith('@')) return `https://t.me/${contact.replace('@', '')}`;
    if (user?.username) return `https://t.me/${String(user.username).replace('@', '')}`;
    if (user?.id) return `tg://user?id=${user.id}`;
    return '';
  }

  function renderAppointmentCard(appointment, archived = false) {
    return (
      <div className="appointment-row" key={appointment.id}>
        <div className="appointment-info">
          <strong>{getAppointmentServices(appointment).map((service) => service.title).join(', ') || appointment.serviceId}</strong>
          <span>{appointment.date} в {appointment.time}</span>
          <span>{appointment.user?.first_name || 'Клиент'} {appointment.user?.username ? `@${appointment.user.username}` : ''}</span>
          {appointment.clientSource && <span>Источник: {appointment.clientSource}</span>}
          {appointment.clientContact && <span>Контакт: {appointment.clientContact}</span>}
          <em className={appointment.status}>{appointmentStatusLabel(appointment.status)}</em>
          {appointment.comment && <span className="appointment-comment-line">Комментарий: {appointment.comment}</span>}
          {appointment.referenceUrl && (
            <a className="reference-link" href={appointment.referenceUrl} target="_blank" rel="noreferrer">Открыть референс</a>
          )}
          {appointment.confirmedAt && <span className="confirm-note small">Клиент подтвердил запись</span>}
        </div>
        <div className="appointment-actions">
          {clientMessageUrl(appointment) && (
            <a href={clientMessageUrl(appointment)} target="_blank" rel="noreferrer">Написать</a>
          )}
          {archived ? (
            <button onClick={() => toggleArchive(appointment.id)}>Вернуть из архива</button>
          ) : (
            <>
              {appointment.status === 'active' && <button onClick={() => complete(appointment.id)}>Завершить</button>}
              {appointment.status !== 'cancelled' && appointment.status !== 'completed' && <button onClick={() => cancel(appointment.id)}>Отменить</button>}
              <button onClick={() => toggleArchive(appointment.id)}>В архив</button>
            </>
          )}
        </div>
      </div>
    );
  }

  const activeAppointments = [...store.appointments]
    .filter((app) => !app.archived)
    .sort((left, right) => `${left.date}T${left.time}`.localeCompare(`${right.date}T${right.time}`));
  const activeGroups = activeAppointments.reduce((groups, appointment) => {
    const current = groups.get(appointment.date) || [];
    current.push(appointment);
    groups.set(appointment.date, current);
    return groups;
  }, new Map());
  const busyPreviewGroups = activeAppointments
    .filter((appointment) => appointment.status !== 'cancelled' && appointment.status !== 'completed')
    .reduce((groups, appointment) => {
      const current = groups.get(appointment.date) || [];
      current.push(appointment);
      groups.set(appointment.date, current);
      return groups;
    }, new Map());
  const archiveAppointments = [...archive].sort((left, right) => `${right.date}T${right.time}`.localeCompare(`${left.date}T${left.time}`));

  return (
    <section className="admin-card glass">
      <div className="archive-header">
        <h2>{view === 'archive' ? 'Архив записей' : 'Записи'}</h2>
        {view === 'archive' ? (
          <button className="secondary small" onClick={() => setView('active')}>← Активные</button>
        ) : (
          <div className="archive-actions">
            <button className="secondary small" onClick={() => setShowBusyList(!showBusyList)}>
              {showBusyList ? 'Скрыть занятые' : 'Занятые окошки'}
            </button>
            <button className="secondary small" onClick={openArchive}>Архив</button>
          </div>
        )}
      </div>

      {view === 'archive' ? (
        <>
          {loadingArchive && <p className="muted">Загрузка...</p>}
          {!loadingArchive && archive.length === 0 && <p className="muted">В архиве пока нет записей.</p>}
          {archiveAppointments.map((appointment) => renderAppointmentCard(appointment, true))}
        </>
      ) : (
        <>
          {showBusyList && (
            <section className="free-slots-preview busy-slots-preview">
              <button className="free-slots-close" onClick={() => setShowBusyList(false)} aria-label="Закрыть список занятых окошек">
                <X size={20} />
              </button>
              <h3>Занятые окошки</h3>
              {[...busyPreviewGroups.entries()].length ? [...busyPreviewGroups.entries()].map(([date, appointments]) => (
                <div className="free-slots-day busy-slots-day" key={date}>
                  <strong>{fullDateLabel(date)}</strong>
                  <div>
                    {appointments.map((appointment) => (
                      <span key={appointment.id}>
                        <b>{appointment.time}</b>
                        <small>{appointment.user?.first_name || appointment.clientName || 'Клиент'} · {getAppointmentServices(appointment).map((service) => service.title).join(', ') || 'Услуга'}</small>
                      </span>
                    ))}
                  </div>
                </div>
              )) : <p className="empty-preview-text">Занятых окошек пока нет.</p>}
            </section>
          )}
          {activeAppointments.length === 0 && <p className="muted">Активных записей нет</p>}
          {[...activeGroups.entries()].map(([date, appointments]) => (
            <section className="busy-day-group" key={date}>
              <div className="busy-day-head">
                <strong>{fullDateLabel(date)}</strong>
                <span>{appointments.length} занято</span>
              </div>
              <div className="busy-day-times">
                {appointments.map((appointment) => <span key={appointment.id}>{appointment.time}</span>)}
              </div>
              {appointments.map((appointment) => renderAppointmentCard(appointment))}
            </section>
          ))}
        </>
      )}
    </section>
  );
}

function AdminReviews({ store, refresh, showToast, openImage }) {
  const appointments = new Map(store.appointments.map((appointment) => [appointment.id, appointment]));
  const services = new Map(store.services.flatMap((category) => category.items.map((item) => [item.id, item])));

  function reviewAppointmentTitle(appointment) {
    const ids = appointment?.serviceIds?.length ? appointment.serviceIds : [appointment?.serviceId].filter(Boolean);
    return ids.map((id) => services.get(id)?.title).filter(Boolean).join(', ') || 'Услуга';
  }

  async function removeReview(id) {
    await api(`/api/admin/reviews/${id}`, { method: 'DELETE' });
    showToast('Отзыв удален');
    await refresh();
  }

  return (
    <section className="admin-card glass">
      <h2>Отзывы</h2>
      {(store.reviews || []).length === 0 && <p className="muted">Отзывов пока нет.</p>}
      {(store.reviews || []).map((review) => {
        const appointment = appointments.get(review.appointmentId);
        return (
          <div className="review-card admin-review-card" key={review.id}>
            <div className="review-card-header">
              <span className="review-author">{review.user?.first_name || 'Клиент'}</span>
              <span className="review-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={14} fill={star <= review.rating ? '#ffd84a' : 'transparent'} color="#ffd84a" />
                ))}
              </span>
            </div>
            {appointment && <span className="review-appointment">{reviewAppointmentTitle(appointment)} · {appointment.date} в {appointment.time}</span>}
            {review.text && <p className="review-text">{review.text}</p>}
            {review.photoUrl && <img className="review-photo" src={review.photoUrl} alt="Фото к отзыву" onClick={() => openImage({ src: review.photoUrl, alt: 'Фото к отзыву' })} />}
            <button className="secondary danger" onClick={() => removeReview(review.id)}>
              <Trash2 size={16} /> Удалить отзыв
            </button>
          </div>
        );
      })}
    </section>
  );
}

function PublicReviews({ data, openImage }) {
  const reviews = data.reviews || [];

  return (
    <main className="content">
      <section className="admin-card glass">
        <h2>Отзывы</h2>
        {reviews.length === 0 && <p className="muted">Отзывов пока нет</p>}
        {reviews.map((review) => (
          <div className="review-card" key={review.id}>
            <div className="review-card-header">
              <span className="review-author">{review.user?.first_name || 'Клиент'}</span>
              <span className="review-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star key={star} size={14} fill={star <= review.rating ? '#ffd84a' : 'transparent'} color="#ffd84a" />
                ))}
              </span>
            </div>
            {review.text && <p className="review-text">{review.text}</p>}
            {review.photoUrl && <img className="review-photo" src={review.photoUrl} alt="Фото к отзыву" onClick={() => openImage({ src: review.photoUrl, alt: 'Фото к отзыву' })} />}
            <span className="review-date">
              {new Date(review.createdAt).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
          </div>
        ))}
      </section>
    </main>
  );
}

function PublicTabs({ active, setActive }) {
  return (
    <nav className="public-tabs">
      <button className={active === 'profile' ? 'active' : ''} onClick={() => setActive('profile')}>
        Профиль
      </button>
      <button className={active === 'appointments' ? 'active' : ''} onClick={() => setActive('appointments')}>
        Запись
      </button>
      <button className={active === 'reviews' ? 'active' : ''} onClick={() => setActive('reviews')}>
        Отзывы
      </button>
    </nav>
  );
}

createRoot(document.getElementById('root')).render(<App />);
