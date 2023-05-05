require('dotenv').config();
require("module-alias/register");
const { Telegraf } = require('telegraf');
const { STREAMERS, GROUPID } = require("@root/config.js");
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Handler for the /start command
bot.command('idcheck', async (ctx) => {
  ctx.reply(`ID Группы: ${(await ctx.getChat()).id}`);
});

bot.start((ctx) => {
  ctx.replyWithPhoto('https://cdn.discordapp.com/attachments/448160851266895873/1098334654945316874/Logo.png', { caption: "Тестовый текст" });
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
    console.log(`Отправка сообщения в группу с ID ${chatId}`);

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
      console.info(`ИНФО:Проверка статуса потока для юзера ${twitchUsername}: ${streamData ? 'Стримит!' : 'Не Стримит!'}`);

      if (streamData) {
        // If user is streaming, extract necessary information
        const streamId = streamData.id;
        if (!streamStatus[twitchUsername] || streamStatus[twitchUsername] !== streamId) {
          // If the streamer is not in the streamStatus object or the stream ID has changed, send notification
          const streamUrl = `https://www.twitch.tv/${twitchUsername}`;
          const thumbnailUrl = streamData.thumbnail_url.replace('{width}', '640').replace('{height}', '360');
          const title = streamData.title;
          const gamename = streamData.game_name;
          const notification = `👾${twitchUsername} запустил(-а) стрим! \n[${gamename}]\n\n${title}\n\n💠${streamUrl}\n\n#stream_kvp`;
          // Send the message to the group
          bot.telegram.sendPhoto(chatId, thumbnailUrl, { caption: notification });
          // Update the streamStatus object with the new stream ID
          streamStatus[twitchUsername] = streamId;
        }
      } else {
        // If user is not streaming, add notification to the array
        //   const notification = `Пользователь "${twitchUsername}" в настоящее время не стримит.`;
        //   bot.telegram.sendMessage(chatId, notification);
        delete streamStatus[twitchUsername];
      }
    }
  } catch (error) {
    console.error(error);
    bot.telegram.sendMessage(chatId, 'Произошла ошибка при проверке статуса потока Twitch.');
  }
}

// Check Twitch stream status every 2 minutes
setInterval(checkStreamStatus, 2 * 60 * 1000);

bot.launch();
console.log("Бот Запущен");
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
