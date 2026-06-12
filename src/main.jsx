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
  MessageCircle,
  Music2,
  Plus,
  Save,
  Settings,
  Star,
  Trash2,
  Upload,
  UserRound,
  X
} from 'lucide-react';
import './styles.css';

const tg = window.Telegram?.WebApp;
const adminNames = new Set(['m_lova_yulia', 'ivyheroin']);

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

  const response = await fetch(path, { ...options, headers });
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

function monthLabel(date) {
  return date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function ymd(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

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
  if (key.includes('telegram')) return <MessageCircle size={17} />;
  return <LinkIcon size={17} />;
}

function App() {
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('public');
  const [publicTab, setPublicTab] = useState('profile');
  const [selected, setSelected] = useState([]);
  const [booking, setBooking] = useState(false);
  const [toast, setToast] = useState('');
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
      <div className="background" style={{ backgroundImage: `url(${data.profile.avatarUrl || data.profile.gallery?.[0] || ''})` }} />
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
        <AdminPanel data={data} reload={load} showToast={showToast} />
      ) : booking && selected.length > 0 ? (
        <BookingFlow
          selected={selected}
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
              showToast={showToast}
            />
          ) : (
            <MyAppointments data={data} reload={load} showToast={showToast} />
          )}
        </>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}

function PublicProfile({ data, selected, setSelected, onContinue, showToast }) {
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
            {profile.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name || 'Мастер'} /> : <UserRound size={54} />}
          </div>
          {hasProfile ? (
            <>
              {profile.name && <h1>{profile.name}</h1>}
              {profile.title && <p className="subtitle">{profile.title}</p>}

              {socials.length > 0 && (
                <div className="socials">
                  {socials.map((social) => (
                    <a key={social.id} href={social.url} target="_blank" rel="noreferrer" aria-label={social.label}>
                      <SocialIcon social={social} />
                    </a>
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
              <img key={src} src={src} alt="Работа мастера" />
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

function ServiceCategory({ category, defaultOpen, selected, setSelected }) {
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
                      <img key={photo} src={photo} alt={item.title} />
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

function BookingFlow({ selected, onBack, onBooked, showToast }) {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState([]);
  const [date, setDate] = useState('');
  const [slots, setSlots] = useState([]);
  const [time, setTime] = useState('');
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
    setDate((current) => current || firstAvailable?.date || '');
  }

  async function loadSlots(nextDate) {
    const result = await api(`/api/public/slots?serviceIds=${serviceQuery}&date=${nextDate}`);
    setSlots(result.slots);
    setTime('');
  }

  async function book() {
    const result = await api('/api/appointments', {
      method: 'POST',
      body: JSON.stringify({ serviceIds, date, time, user: getUser() })
    });
    setDone(result.appointment);
    showToast('Запись создана!');
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
            <button onClick={onBack} aria-label="Назад"><ChevronLeft /></button>
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

function MyAppointments({ data, reload, showToast }) {
  const [appointments, setAppointments] = useState([]);
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAppointments();
  }, []);

  async function loadAppointments() {
    setLoading(true);
    const result = await api('/api/my/appointments');
    setAppointments(result.appointments || []);
    setLoading(false);
  }

  async function refreshAll() {
    await loadAppointments();
    await reload();
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
        showToast={showToast}
      />
    );
  }

  return (
    <main className="content">
      <section className="admin-card glass">
        <h2>Мои записи</h2>
        {loading && <p className="muted">Загрузка...</p>}
        {!loading && appointments.length === 0 && <p className="muted">Записей пока нет.</p>}
        {appointments.map((appointment) => (
          <button className="my-appointment" key={appointment.id} onClick={() => setActive(appointment)}>
            <strong>{appointmentTitle(appointment)}</strong>
            <span>{appointment.date} в {appointment.time}</span>
            <em>{appointment.status === 'cancelled' ? 'Отменена' : appointment.review ? 'Отзыв оставлен' : 'Открыть'}</em>
          </button>
        ))}
      </section>
    </main>
  );
}

function AppointmentDetails({ appointment, onBack, onReviewed, onCancelled, showToast }) {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [review, setReview] = useState(appointment.review);
  const isCancelled = appointment.status === 'cancelled';
  const services = appointmentServices(appointment);
  const totalPrice = appointment.totalPrice || services.reduce((sum, service) => sum + Number(service.price || 0), 0);
  const totalDuration = appointment.totalDurationMinutes || services.reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0);

  async function sendReview() {
    const result = await api('/api/reviews', {
      method: 'POST',
      body: JSON.stringify({ appointmentId: appointment.id, rating, text, user: getUser() })
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
        {isCancelled && <p className="muted">Эта запись отменена.</p>}
        {!isCancelled && (
          <button className="secondary danger" onClick={cancelAppointment}>Отменить запись</button>
        )}
        {review ? (
          <div className="review-summary">
            <strong>Твоя оценка: {review.rating}/5</strong>
            {review.text && <p>{review.text}</p>}
          </div>
        ) : !isCancelled ? (
          <>
            <div className="stars">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} aria-label={`${star} звезд`}>
                  <Star fill={star <= rating ? '#ffd84a' : 'transparent'} color="#ffd84a" />
                </button>
              ))}
            </div>
            <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="Отзыв после визита можно оставить здесь" />
            <button className="primary" onClick={sendReview}>Оставить отзыв</button>
          </>
        ) : null}
      </section>
    </main>
  );
}

function AdminPanel({ data, reload, showToast }) {
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
            ['services', 'Услуги'],
            ['schedule', 'График']
          ].map(([id, label]) => (
            <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </section>

      {tab === 'profile' && <AdminProfile store={store} refresh={refresh} showToast={showToast} />}
      {tab === 'services' && <AdminServices store={store} refresh={refresh} showToast={showToast} />}
      {tab === 'schedule' && <AdminSchedule store={store} refresh={refresh} showToast={showToast} />}
      {tab === 'appointments' && <AdminAppointments store={store} refresh={refresh} showToast={showToast} data={data} />}
    </main>
  );
}

function AdminProfile({ store, refresh, showToast }) {
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
      if (target === 'gallery') {
        const gallery = [...(profile.gallery || [])];
        gallery[index] = url;
        setProfile({ ...profile, gallery: gallery.slice(0, 3) });
        showToast('Фото загружено. Нажми “Сохранить”.');
      }
    };
    input.click();
  }

  return (
    <section className="admin-card glass">
      <label>Имя<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} /></label>
      <label>Заголовок<input value={profile.title} onChange={(event) => setProfile({ ...profile, title: event.target.value })} /></label>
      <label>Адрес<input value={profile.address} onChange={(event) => setProfile({ ...profile, address: event.target.value })} /></label>
      <label>Описание<textarea value={profile.description} onChange={(event) => setProfile({ ...profile, description: event.target.value })} /></label>
      <button className="secondary" onClick={() => upload('avatar')}><Upload size={17} /> Загрузить аватар</button>
      <div className="admin-gallery">
        {[0, 1, 2].map((index) => (
          <button key={index} onClick={() => upload('gallery', index)}>
            {profile.gallery?.[index] ? <img src={profile.gallery[index]} alt="" /> : <Plus />}
          </button>
        ))}
      </div>
      <h3>Соцсети</h3>
      {(profile.socials || []).map((social, index) => (
        <div className="inline-fields" key={social.id}>
          <input value={social.label} placeholder="Название" onChange={(event) => {
            const socials = [...profile.socials];
            socials[index] = { ...social, label: event.target.value, type: event.target.value };
            setProfile({ ...profile, socials });
          }} />
          <input value={social.url} placeholder="Ссылка или @username" onChange={(event) => {
            const socials = [...profile.socials];
            socials[index] = { ...social, url: event.target.value };
            setProfile({ ...profile, socials });
          }} />
          <button onClick={() => setProfile({ ...profile, socials: profile.socials.filter((_, i) => i !== index) })}><Trash2 size={16} /></button>
        </div>
      ))}
      <button className="secondary" onClick={() => setProfile({ ...profile, socials: [...(profile.socials || []), { id: uid('soc'), label: 'Ссылка', type: 'link', url: '' }] })}>
        <Plus size={17} /> Добавить ссылку
      </button>
      <button className="primary" onClick={save}><Save size={18} /> Сохранить</button>
    </section>
  );
}

function AdminServices({ store, refresh, showToast }) {
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
                  <button key={photoIndex} onClick={() => uploadPhoto(catIndex, itemIndex, photoIndex)}>
                    {item.photos?.[photoIndex] ? <img src={item.photos[photoIndex]} alt="" /> : <Plus />}
                  </button>
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

function AdminSchedule({ store, refresh, showToast }) {
  const [schedule, setSchedule] = useState(store.schedule);
  const [blockDate, setBlockDate] = useState(ymd(new Date()));
  const [blockTime, setBlockTime] = useState('10:00');
  const week = [
    ['1', 'Пн'], ['2', 'Вт'], ['3', 'Ср'], ['4', 'Чт'], ['5', 'Пт'], ['6', 'Сб'], ['0', 'Вс']
  ];

  async function save(next = schedule) {
    await api('/api/admin/schedule', { method: 'PUT', body: JSON.stringify({ schedule: next }) });
    setSchedule(next);
    showToast('График сохранен');
    refresh();
  }

  return (
    <section className="admin-card glass">
      {week.map(([key, label]) => (
        <label key={key}>{label}
          <input
            value={(schedule.workDays[key] || []).join(', ')}
            placeholder="10:00, 12:00, 14:00"
            onChange={(event) => setSchedule({
              ...schedule,
              workDays: { ...schedule.workDays, [key]: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) }
            })}
          />
        </label>
      ))}
      <h3>Заблокированные дни</h3>
      <div className="inline-fields">
        <input type="date" value={blockDate} onChange={(event) => setBlockDate(event.target.value)} />
        <button onClick={() => setSchedule({ ...schedule, blockedDates: [...new Set([...(schedule.blockedDates || []), blockDate])] })}>Добавить</button>
      </div>
      <div className="chips">
        {schedule.blockedDates?.map((date) => (
          <button key={date} onClick={() => setSchedule({ ...schedule, blockedDates: schedule.blockedDates.filter((item) => item !== date) })}>
            {date} <X size={14} />
          </button>
        ))}
      </div>
      <h3>Заблокированное время</h3>
      <div className="inline-fields">
        <input type="date" value={blockDate} onChange={(event) => setBlockDate(event.target.value)} />
        <input type="time" value={blockTime} onChange={(event) => setBlockTime(event.target.value)} />
        <button onClick={() => setSchedule({ ...schedule, blockedSlots: [...(schedule.blockedSlots || []), { date: blockDate, time: blockTime }] })}>Добавить</button>
      </div>
      <div className="chips">
        {schedule.blockedSlots?.map((slot, index) => (
          <button key={`${slot.date}-${slot.time}-${index}`} onClick={() => setSchedule({ ...schedule, blockedSlots: schedule.blockedSlots.filter((_, i) => i !== index) })}>
            {slot.date} {slot.time} <X size={14} />
          </button>
        ))}
      </div>
      <button className="primary" onClick={() => save()}><Save size={18} /> Сохранить график</button>
    </section>
  );
}

function AdminAppointments({ store, refresh, showToast }) {
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

  function clientMessageUrl(user) {
    if (user?.username) return `https://t.me/${String(user.username).replace('@', '')}`;
    if (user?.id) return `tg://user?id=${user.id}`;
    return '';
  }

  return (
    <section className="admin-card glass">
      {store.appointments.length === 0 && <p className="muted">Записей пока нет</p>}
      {store.appointments.map((appointment) => (
        <div className="appointment-row" key={appointment.id}>
          <div className="appointment-info">
            <strong>{getAppointmentServices(appointment).map((service) => service.title).join(', ') || appointment.serviceId}</strong>
            <span>{appointment.date} в {appointment.time}</span>
            <span>{appointment.user?.first_name || 'Клиент'} {appointment.user?.username ? `@${appointment.user.username}` : ''}</span>
          </div>
          <em className={appointment.status}>{appointment.status}</em>
          <div className="appointment-actions">
            {clientMessageUrl(appointment.user) && (
              <a href={clientMessageUrl(appointment.user)} target="_blank" rel="noreferrer">Написать</a>
            )}
            {appointment.status !== 'cancelled' && <button onClick={() => cancel(appointment.id)}>Отменить</button>}
          </div>
        </div>
      ))}
    </section>
  );
}

function PublicTabs({ active, setActive }) {
  return (
    <nav className="public-tabs">
      <button className={active === 'profile' ? 'active' : ''} onClick={() => setActive('profile')}>
        Профиль
      </button>
      <button className={active === 'appointments' ? 'active' : ''} onClick={() => setActive('appointments')}>
        Мои записи
      </button>
    </nav>
  );
}

createRoot(document.getElementById('root')).render(<App />);
