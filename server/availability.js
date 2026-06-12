function pad(value) {
  return String(value).padStart(2, '0');
}

export function formatDate(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateTime(date, time) {
  return new Date(`${date}T${time}:00`);
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

export function getAvailableSlots(store, date, serviceId) {
  const found = findService(store, serviceId);
  const duration = found?.service?.durationMinutes || 60;
  const day = new Date(`${date}T00:00:00`);
  const dow = String(day.getDay());
  const baseSlots = store.schedule.workDays[dow] || [];

  if (store.schedule.blockedDates.includes(date)) return [];

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
        const otherService = findService(store, appointment.serviceId)?.service;
        const otherStart = toDateTime(appointment.date, appointment.time);
        const otherEnd = new Date(
          otherStart.getTime() + (otherService?.durationMinutes || 60) * 60_000
        );
        return overlaps(start, end, otherStart, otherEnd);
      });
  });
}

export function getMonthAvailability(store, year, month, serviceId) {
  const lastDay = new Date(year, month, 0).getDate();
  const days = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const slots = getAvailableSlots(store, date, serviceId);
    days.push({ date, available: slots.length > 0, slots });
  }
  return days;
}
