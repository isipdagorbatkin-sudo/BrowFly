import 'dotenv/config';
import app from './app.js';
import { startBot, startReminderLoop } from './bot.js';

const port = Number(process.env.PORT || 3001);

app.listen(port, () => {
  console.log(`API started on http://localhost:${port}`);
});

startBot();
startReminderLoop();
