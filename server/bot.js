import { Telegraf, Markup } from 'telegraf';
import { readStore, updateStore } from './store.js';
import { isAdminUser } from './auth.js';
import { findService, toDateTime } from './availability.js';

let bot = null;

export function getBot() {
  return bot;
}

export function startBot() {
  if (!process.env.BOT_TOKEN) {
    console.log('BOT_TOKEN is not set, bot was not started.');
    return null;
  }

  bot = new Telegraf(process.env.BOT_TOKEN);
  const webAppUrl = process.env.PUBLIC_WEBAPP_URL || 'http://localhost:5173';

  bot.start(async (ctx) => {
    if (isAdminUser(ctx.from)) {
      await updateStore((draft) => {
        draft.adminChatIds = [...new Set([...(draft.adminChatIds || []), ctx.chat.id])];
      }).catch(() => {});
    }

    await ctx.reply(
      '\u041f\u0440\u0438\u0432\u0435\u0442! \u0417\u0434\u0435\u0441\u044c \u043c\u043e\u0436\u043d\u043e \u0437\u0430\u043f\u0438\u0441\u0430\u0442\u044c\u0441\u044f \u043a \u042e\u043b\u0438\u0438 \u043d\u0430 \u0440\u0435\u0441\u043d\u0438\u0446\u044b \u0438\u043b\u0438 \u0431\u0440\u043e\u0432\u0438.',
      Markup.inlineKeyboard([
        Markup.button.webApp('\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0437\u0430\u043f\u0438\u0441\u044c', webAppUrl)
      ])
    );
  });

  bot.command('admin', async (ctx) => {
    if (isAdminUser(ctx.from)) {
      await updateStore((draft) => {
        draft.adminChatIds = [...new Set([...(draft.adminChatIds || []), ctx.chat.id])];
      }).catch(() => {});
    }

    await ctx.reply(
      '\u0410\u0434\u043c\u0438\u043d\u043a\u0430 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u0435\u0442\u0441\u044f \u0432\u043d\u0443\u0442\u0440\u0438 \u043f\u0440\u0438\u043b\u043e\u0436\u0435\u043d\u0438\u044f.',
      Markup.inlineKeyboard([
        Markup.button.webApp('\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u0430\u0434\u043c\u0438\u043d\u043a\u0443', `${webAppUrl}?admin=1`)
      ])
    );
  });

  bot.launch();
  console.log('Telegram bot started.');
  return bot;
}

export async function notifyAdminAboutAppointment(appointment) {
  if (!bot) return;
  const store = await readStore();
  const service = findService(store, appointment.serviceId)?.service;
  const chatIds = store.adminChatIds || [];

  await Promise.allSettled(
    chatIds.map((chatId) =>
      bot.telegram.sendMessage(
        chatId,
        [
          '\u041d\u043e\u0432\u0430\u044f \u0437\u0430\u043f\u0438\u0441\u044c',
          `\u041a\u043b\u0438\u0435\u043d\u0442: ${appointment.user?.first_name || '\u041a\u043b\u0438\u0435\u043d\u0442'} ${appointment.user?.username ? `@${appointment.user.username}` : ''}`,
          `\u0423\u0441\u043b\u0443\u0433\u0430: ${service?.title || appointment.serviceId}`,
          `\u0414\u0430\u0442\u0430: ${appointment.date}`,
          `\u0412\u0440\u0435\u043c\u044f: ${appointment.time}`,
          `\u0426\u0435\u043d\u0430: ${service?.price || 0} \u20bd`
        ].join('\n')
      )
    )
  );
}

export function startReminderLoop() {
  setInterval(async () => {
    if (!bot) return;
    const store = await readStore();
    const now = new Date();
    const windowStart = new Date(now.getTime() + 3 * 60 * 60_000 - 60_000);
    const windowEnd = new Date(now.getTime() + 3 * 60 * 60_000 + 60_000);

    for (const appointment of store.appointments) {
      if (appointment.status === 'cancelled' || appointment.reminderSentAt || !appointment.user?.id) {
        continue;
      }

      const startsAt = toDateTime(appointment.date, appointment.time);
      if (startsAt >= windowStart && startsAt <= windowEnd) {
        const service = findService(store, appointment.serviceId)?.service;
        await bot.telegram.sendMessage(
          appointment.user.id,
          `\u041d\u0430\u043f\u043e\u043c\u0438\u043d\u0430\u043d\u0438\u0435: \u0447\u0435\u0440\u0435\u0437 3 \u0447\u0430\u0441\u0430 \u0437\u0430\u043f\u0438\u0441\u044c \u043a \u042e\u043b\u0438\u0438. ${service?.title || '\u0423\u0441\u043b\u0443\u0433\u0430'} \u0432 ${appointment.time}, ${appointment.date}.`
        );
        await updateStore((draft) => {
          const current = draft.appointments.find((item) => item.id === appointment.id);
          if (current) current.reminderSentAt = new Date().toISOString();
        });
      }
    }
  }, 60_000);
}
