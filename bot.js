require('dotenv').config();
require("module-alias/register");
const { Telegraf } = require('telegraf');
const { STREAMERS } = require("@root/config.js");
const axios = require('axios');

const bot = new Telegraf(process.env.BOT_TOKEN);

// Handler for the /start command
bot.start((ctx) => {
    ctx.replyWithPhoto('https://cdn.discordapp.com/attachments/448160851266895873/1098334654945316874/Logo.png', { caption: "Тестовый текст" });
});

// Handler for checking Twitch stream status and sending notification
bot.command('check', async (ctx) => {
    try {
        const twitchUsernames = STREAMERS; // Array of Twitch usernames
        const twitchClientId = process.env.TWITCH_CLIENT_ID; // Replace with your Twitch client ID
        const twitchAccessToken = process.env.TWITCH_ACCESS; // Replace with your Twitch access token

        // Loop through the array of Twitch usernames
        for (const twitchUsername of twitchUsernames) {
            const twitchApiUrl = `https://api.twitch.tv/helix/streams?user_login=${twitchUsername}`;
            // Fetch stream status from Twitch API with OAuth token in headers
            const response = await axios.get(twitchApiUrl, {
                headers: {
                    'Client-ID': twitchClientId,
                    'Authorization': `Bearer ${twitchAccessToken}` // Include OAuth token in headers
                }
            });

            const streamData = response.data.data[0];
            console.log(streamData)
            if (streamData) {
                // If user is streaming, extract necessary information
                //const viewerCount = streamData.viewer_count;
                const streamUrl = `https://www.twitch.tv/${twitchUsername}`;
                const thumbnailUrl = streamData.thumbnail_url.replace('{width}', '640').replace('{height}', '360');
                const title = streamData.title;
                const gamename = streamData.game_name;
                const notification = `${twitchUsername} запустил(-а) стрим! \n[${gamename}]\n\n${title}\n\n${streamUrl}\n\n#stream_kvp`;
                ctx.replyWithPhoto(thumbnailUrl, { caption: notification, });
            } else {
                // If user is not streaming, add notification to the array
                const notification = `Пользователь "${twitchUsername}" в настоящее время не стримит.`;
                ctx.reply(notification);
            }
        }

    } catch (error) {
        console.error(error);
        ctx.reply('Произошла ошибка при проверке статуса потока Twitch.');
    }
});


bot.launch();
console.log("Бот Запущен")
// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
