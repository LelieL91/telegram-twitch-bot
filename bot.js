require('dotenv').config();
require("module-alias/register");

const pino = require('pino')
const logger = pino.default(
  {
    level: "info",
  },
  pino.transport({
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:yyyy-mm-dd HH:MM:ss",
      ignore: "pid,hostname",
      singleLine: false,
      hideObject: false,
      customColors: "info:blue,warn:yellow,error:red",
    },
  })
);

const { Telegraf } = require('telegraf');
const { STREAMERS, GROUPID, TIME, MESSAGE } = require("@root/config.js");
const axios = require('axios');

let parMessage = (content, twitchUsername, game, title, streamUrl, viewerCount, language) => {
  return content
    .replaceAll(/{twitchUsername}/g, twitchUsername)
    .replaceAll(/{game}/g, game)
    .replaceAll(/{title}/g, title)
    .replaceAll(/{streamUrl}/g, streamUrl)
    .replaceAll(/{viewerCount}/g, viewerCount)
    .replaceAll(/{language}/g, language);
};

const bot = new Telegraf(process.env.BOT_TOKEN);

// Handler for the /start command
bot.command('idcheck', async (ctx) => {
  ctx.reply(`ID Чата/Группы/Канала: <b>${(await ctx.getChat()).id}</b>`, { parse_mode: 'HTML' });
});

bot.start((ctx) => {
  ctx.reply(`Привет, бот запущен!\n\nВыбранная Группа: <b>${GROUPID}</b>.\n\nПроверка каждые <b>${TIME}</b> мин.\n\nСтримеры: <pre>${STREAMERS}</pre>`, { parse_mode: 'HTML' });
});

// Store the status of each streamer in an object
let streamStatus = {};

// Handler for checking Twitch stream status and sending notification
async function checkStreamStatus() {
  try {
    const twitchUsernames = STREAMERS; // Array of Twitch usernames
    const twitchClientId = process.env.TWITCH_CLIENT_ID; // Replace with your Twitch client ID
    const twitchAccessToken = process.env.TWITCH_ACCESS; // Replace with your Twitch access token

    // Get the chat ID for the group
    const chatId = GROUPID;
    logger.info(`Sending a message to a group with an ID ${chatId}`);

    // Loop through the array of Twitch usernames
    for (const twitchUsername of twitchUsernames) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Add a delay of 1 second between iterations

      const twitchApiUrl = `https://api.twitch.tv/helix/streams?user_login=${twitchUsername}`;
      // Fetch stream status from Twitch API with OAuth token in headers
      const response = await axios.get(twitchApiUrl, {
        headers: {
          'Client-ID': twitchClientId,
          'Authorization': `Bearer ${twitchAccessToken}` // Include OAuth token in headers
        }
      });

      const streamData = response.data.data[0];
      logger.info(`Checking the status of a stream for a user ${twitchUsername}: ${streamData ? 'is Streaming!' : 'not streaming.'}`);

      if (streamData) {
        logger.info(streamData);
        // If user is streaming, extract necessary information
        if (!streamStatus[twitchUsername] || streamStatus[twitchUsername] !== streamData.id) {
          // If the streamer is not in the streamStatus object or the stream ID has changed, send notification
          const streamUrl = `https://www.twitch.tv/${twitchUsername}`;
          const thumbnailUrl = streamData.thumbnail_url.replace('{width}', '640').replace('{height}', '360') + `?timestamp=${Date.now()}`;
          // const notification = `👾${twitchUsername} запустил(-а) стрим! \n[${gamename}]\n\n${title}\n\n💠${streamUrl}\n`;
          const notification = parMessage(MESSAGE, streamData.user_name, streamData.game_name, streamData.title, streamUrl, streamData.viewer_count, streamData.language);
          // Send the message to the group
          bot.telegram.sendPhoto(chatId, thumbnailUrl, { caption: notification });
          // Update the streamStatus object with the new stream ID
          streamStatus[twitchUsername] = streamData.id;
        }
      } else {
        // If user is not streaming, add notification to the array
        delete streamStatus[twitchUsername];
      }
    }
  } catch (error) {
    logger.error(error);
    bot.telegram.sendMessage(chatId, 'Произошла ошибка при проверке статуса потока Twitch.');
  }
}

// Check Twitch stream status every TIME minutes
setInterval(checkStreamStatus, TIME * 60 * 1000);

bot.launch();
logger.info("Bot Started!");
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
