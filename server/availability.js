function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateTime(date, time) {
  const [year, month, day] = String(date).split('-').map(Number);
  const [hours, minutes] = String(time).split(':').map(Number);

  return new Date(Date.UTC(year, month - 1, day, hours - 3, minutes || 0, 0));
}

function overlaps(startA, endA, startB, endB) {
  return startA < endB && startB < endA;
}

export function findService(store, serviceId) {
  for (const category of store.services) {
    const service = category.items.find((item) => item.id === serviceId);
    if (service) return { category, service };
  }
  return null;
}

export function normalizeServiceIds(value) {
  const ids = Array.isArray(value)
    ? value
    : String(value || '').split(',');

  return [...new Set(ids.map((id) => String(id || '').trim()).filter(Boolean))];
}

export function getAppointmentServiceIds(appointment) {
  return normalizeServiceIds(
    appointment.serviceIds?.length ? appointment.serviceIds : appointment.serviceId
  );
}

export function findServices(store, serviceIds) {
  return normalizeServiceIds(serviceIds)
    .map((serviceId) => findService(store, serviceId))
    .filter(Boolean);
}

export function getServicesSummary(store, serviceIds) {
  const found = findServices(store, serviceIds);
  const services = found.map((item) => item.service);
  return {
    services,
    categories: found.map((item) => ({ id: item.category.id, title: item.category.title })),
    totalDurationMinutes: services.reduce((sum, service) => sum + Number(service.durationMinutes || 0), 0),
    totalPrice: services.reduce((sum, service) => sum + Number(service.price || 0), 0)
  };
}

export function getAvailableSlots(store, date, serviceIds) {
  const summary = getServicesSummary(store, serviceIds);
  const duration = summary.totalDurationMinutes || 60;
  const day = new Date(`${date}T00:00:00`);
  const dow = String(day.getDay());
  const hasDateSlots = store.schedule.dateSlots && Object.keys(store.schedule.dateSlots).length > 0;
  const baseSlots = hasDateSlots
    ? store.schedule.dateSlots[date] || []
    : store.schedule.workDays[dow] || [];

  if ((store.schedule.blockedDates || []).includes(date)) return [];

  const now = new Date();
  return baseSlots.filter((time) => {
    if (store.schedule.blockedSlots.some((slot) => slot.date === date && slot.time === time)) {
      return false;
    }

    const start = toDateTime(date, time);
    const end = new Date(start.getTime() + duration * 60_000);
    if (start <= now) return false;

    return !store.appointments
      .filter((appointment) => appointment.status !== 'cancelled')
      .some((appointment) => {
        const otherSummary = getServicesSummary(store, getAppointmentServiceIds(appointment));
        const otherStart = toDateTime(appointment.date, appointment.time);
        const otherEnd = new Date(
          otherStart.getTime() + (otherSummary.totalDurationMinutes || 60) * 60_000
        );
        return overlaps(start, end, otherStart, otherEnd);
      });
  });
}

export function getMonthAvailability(store, year, month, serviceIds) {
  const lastDay = new Date(year, month, 0).getDate();
  const days = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const slots = getAvailableSlots(store, date, serviceIds);
    days.push({ date, available: slots.length > 0, slots });
  }
  return days;
}
