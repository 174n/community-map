require('dotenv').config();

const fs = require('fs');
const path = require("path");

const md = require('markdown-it')({ html: true });
const sanitizeHtml = require('sanitize-html');
const { fillMarkdownEntitiesMarkup } = require('@rundik/telegram-text-entities-filler');

const { Telegraf } = require('telegraf');

const Fuse = require('fuse.js');
const slugify = require('slugify', { replacement: ' ' });
const fastify = require('fastify')({ logger: true, trustProxy: '127.0.0.1' });
const knex = require('knex')(require("./knexfile.js"));
const superagent = require('superagent');
const moize = require('moize');

const dataPath = path.join(__dirname, "..", "data");
const parseDataFolder = (folder, regex, formatter) =>
  fs.readdirSync(path.join(dataPath, folder))
    .filter(f => f.match(regex))
    .map(f => {
      try {
        const file = fs.readFileSync(path.join(dataPath, folder, f));
        const data = JSON.parse(file.toString());
        if (formatter)
          formatter(f, data);
        return data;
      } catch (err) {
        fastify.log.error(`Error parsing country list at /data/${folder}/${f}\n`, err);
        process.exit();
      }
    });

const config = JSON.parse(fs.readFileSync(path.join(dataPath, "config.json")).toString());

const cities = parseDataFolder("cities", /^\w+\.json$/g, (f, data) => {
  data.map(c => c.country = f.match(/^(\w+)\./g)[0].slice(0, -1));
}).reduce((a, v) => [...a, ...v], []);
cities.forEach(c => !c?.state && fastify.log.info(c))
const geojsons = parseDataFolder("geojsons", /^\w+\.geo\.json$/g).reduce((a, v) => {
  a[v.properties.ISO2.toLowerCase()] = v;
  return a;
}, {});

const fuse = new Fuse(cities, {
  keys: ['name'],
  includeScore: true
});


const search = q => fuse.search(slugify(q)).slice(0, 3);

const insertOrUpdate = (tableName, rows) => {
  return knex.transaction((trx) => {
    const queries = rows.map((tuple) => {
      const insert = trx(tableName).insert(tuple).toString();
      const update = trx(tableName).update(tuple).toString().replace(/^update(.*?)set\s/gi, '');
      return trx.raw(`${insert} ON CONFLICT(user_id) DO UPDATE SET ${update}`).transacting(trx);
    })
    return Promise.all(queries).then(trx.commit).catch(trx.rollback);
  })
}

if (process.env.WEBHOOK_PATH?.length > 0) {
  fastify.register(require('middie')).then(() => {
    fastify.use(bot.webhookCallback(`/${process.env.WEBHOOK_PATH}`));
    bot.telegram.setWebhook(`${process.env.WEBHOOK_PATH}`);
  });
}

const templateThisShit = moize(filename => {
  let file = fs.readFileSync(path.join(dataPath, "public", filename.replace(/\/$/g, "index.html"))).toString();

  Object.keys(config.variables).forEach(k => {
    file = file.replace(new RegExp(`\{\{${k}\}\}`, "gi"), config.variables[k]);
  });
  return file;
}, { maxAge: 1000 * 60 * config.templateRefreshMinutes });

fastify.register(require('fastify-static'), {
  root: path.join(__dirname, '..', 'data', 'public'),
  prefix: '/',
});

fastify.register(require('under-pressure'), {
  maxEventLoopDelay: 1000,
  maxHeapUsedBytes: 100000000,
  maxRssBytes: 100000000,
  maxEventLoopUtilization: 0.98,
  exposeStatusRoute: {
    routeOpts: {
      logLevel: 'silent'
    }
  }
});

const parseRoute = async (request, reply) => {
  const html = templateThisShit(request.url);
  const contentType = request.url.slice(-2) === "js" ? "application/js" : request.url === '/manifest.webmanifest' ? "application/manifest+json" : "text/html";
  return reply.type(`${contentType}; charset=utf-8`).headers({
    "Cache-Control": 60 * config.templateRefreshMinutes
  }).send(html);
};

fastify.get('/', parseRoute);
// fastify.get('/*.html', parseRoute);
fastify.get('/*.js', parseRoute);
fastify.get('/manifest.webmanifest', parseRoute);

// fastify.register(require('fastify-cors'), {
//    origin: true,
//    allowedHeaders: ['Origin', 'X-Requested-With', 'Accept', 'Content-Type', 'Authorization'],
//    methods: ['GET', 'PUT', 'PATCH', 'POST', 'DELETE']
// });

fastify.get('/countries', async (request, reply) => {
  return geojsons;
});

fastify.get('/records', async (request, reply) => {
  const res = await knex('users')
    .select(["id", "name", "username", "created_at", "updated_at", "lat", "lng", "city", "birthdate", "description"]);
  // fastify.log.info(res);
  return res;
});

fastify.get('/records/:country', async (request, reply) => {
  if (!request.params || Object.keys(geojsons).indexOf(request.params.country) === -1)
    return reply.code(404).send({ "error": "Not found" });
  let res;
  try {
    res = await knex('users')
    .select(["id", "name", "username", "created_at", "updated_at", "lat", "lng", "city", "birthdate", "description"])
    .where({ country: request.params.country });
  } catch (err) {
    return reply.code(500).send({ "error": "Server error" });
  }
  return res;
});

const start = async () => {
  try {
    await fastify.listen(8080, '0.0.0.0');
    fastify.log.info(`server listening on ${fastify.server.address().port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}
start();

// Bot
const bot = new Telegraf(process.env.TG_TOKEN);
const clean = dirty => sanitizeHtml(dirty, {
  allowedTags: [ 'b', 'i', 'em', 'strong', 'a', 's', 'u' ],
  allowedAttributes: {
    'a': [ 'href' ]
  }
});

const getChatLinks = state => config.chats[state].chatURLs.map(u => `${u.prefix}${u.url}`).join('\n');
const getShortName = state => config.chats[state].land || state.replace(/[^A-Z]+/g, "") || '';

bot.start((ctx) => ctx.reply('Привет! Введи свой город:'))

bot.on('new_chat_members', (ctx) => fastify.log.info(ctx.message.new_chat_members));

bot.command('menu', ctx => {
  ctx.reply("Выбери один из пунктов", {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      inline_keyboard:
        [[{
          text: "Указать возраст",
          callback_data: "age"
        }],
        [{
          text: "Указать описание",
          callback_data: "description"
        }]]
    })
  });
});

bot.on('text', async ctx => {
  const reply = ctx.message.reply_to_message;
  if (reply && reply.text) {
    if (reply.text.codePointAt(0) === 128197) {
      const errorMsg = '🚫 _Сообщение должно быть в таком формате_:```\n30.12.1990```';
      if (ctx.message.text.match(/^\d{1,2}\.\d{1,2}\.\d{4}$/g)) {
        const date = new Date(...ctx.message.text.split(".").reverse());
        if (date != "Invalid Date") {
          const age = new Date().getFullYear() - date.getFullYear();
          const word = age.toString().slice(-1) === '1' ? 'год' :
            ['2', '3', '4'].includes(age.toString().slice(-1)) ? 'года' : 'лет';
          try {
            await knex('users')
              .where({ user_id: ctx.from.id})
              .update({
                birthdate: date,
                updated_at: new Date()
              });
          } catch(err) {
            fastify.log.error(err);
            return ctx.replyWithMarkdown('🚫 _ошибка бд_');
          }
          return ctx.replyWithMarkdown(`Тебе *${age} ${word}*\n📍 _Возраст отмечен на карте_`);
        } else {
          return ctx.replyWithMarkdown(errorMsg);
        }
      }
      return ctx.replyWithMarkdown(errorMsg);
    } else if (reply.text.codePointAt(0) === 128221) {
      if (ctx.message.text && ctx.message.text.length > 0) {
        const msg = md.render(clean(fillMarkdownEntitiesMarkup(ctx.message.text.slice(0, 250), ctx.message.entities)));
        try {
          await knex('users')
            .where({ user_id: ctx.from.id})
            .update({
              description: msg,
              updated_at: new Date()
            });
        } catch(err) {
          fastify.log.error(err);
          return ctx.replyWithMarkdown('🚫 _ошибка бд_');
        }
        return ctx.replyWithMarkdown("✅ _Описание добавлено_");
      } else {
        return ctx.reply("🚫 _Сообщение должно быть с буквами_");
      }
    }
  }

  const answer = search(ctx.message.text);
  
  let optionalParams = {
    parse_mode: 'Markdown',
    reply_markup: JSON.stringify({
      inline_keyboard:
        answer.map(v => ([{
          text: `${v.item.name} (${getShortName(v.item.state)})`,
          callback_data: v.refIndex
        }]))
    })
  };

  ctx.reply("Выбери город", optionalParams);
});

bot.on('callback_query', ctx => {
  if (ctx.callbackQuery.data.match(/\d+/g)) {
    const city = cities[parseInt(ctx.callbackQuery.data)];

    insertOrUpdate("users", [
      {
        username: ctx.from.username || null,
        user_id: ctx.from.id,
        name: `${ctx.from.first_name} ${ctx.from.last_name || ""}`
          .replace(/[^A-Za-zА-Яа-яЁё0-9 \-,._]+/g, "*")
          .replace(/\s+$/g, ""),
        city: `${city.name} (${getShortName(city.state)})`,
        city_data: JSON.stringify(city),
        lat: city.coords.lat,
        lng: city.coords.lon,
        country: city.country,
        updated_at: new Date()
      }
    ]);
    
    try {
      ctx.answerCbQuery("Город успешно установлен");
    } catch (err) {}

    ctx.reply(`Твой город установлен на <b>${city.name}</b>\n${getChatLinks(city.state)}\nДополнительные настройки: /menu`, { parse_mode: 'HTML' });

    fastify.log.info(`added ${JSON.stringify(ctx.from)} to ${JSON.stringify(city)}`);
  } else if (ctx.callbackQuery.data === "age") {
    ctx.answerCbQuery();
    ctx.reply("📅 Ответь на это сообщение датой рождения (надо нажать на ↩️ reply)");
  } else if (ctx.callbackQuery.data === "description") {
    ctx.answerCbQuery();
    ctx.reply("📝 Ответь на это сообщение описанием (надо нажать на ↩️ reply, до 250 символов)");
  } else {
    ctx.answerCbQuery("Непредвиденная ошибка");
  }
});

const sleep = (milliseconds) => {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}

const req = async url =>
  JSON.parse((await superagent.get(url)).text)

const baseURL = `https://api.telegram.org/bot${process.env.TG_TOKEN}`;

const getAvatar = async id => {
  const photo = (await req(`${baseURL}/getUserProfilePhotos?user_id=${id}&limit=1`)).result.photos[0][0];
  const file = (await req(`${baseURL}/getFile?file_id=${photo.file_id}`)).result;

  const buffer = await superagent
    .get(`https://api.telegram.org/file/bot${process.env.TG_TOKEN}/${file.file_path}?file_id=${file.file_id}`)
    .responseType('blob');
  return buffer.body;
}

const saveAllAvatars = async (ids, i = 0) => {
  const id = ids[i];
  fastify.log.info(`Fetching avatars: [${i + 1}/${ids.length}] ${id.user_id}`);
  let avatar;
  try {
    avatar = await getAvatar(id.user_id);
  } catch (err) {
    fastify.log.error(`Error: ${err.status}`);
  }
  if (avatar)
    fs.writeFileSync(path.join(dataPath, 'public', 'avatars', `${id.id}.jpg`), avatar);
  await sleep(500);
  return ids[i + 1] ? saveAllAvatars(ids, i + 1) : true;
}

var CronJob = require('cron').CronJob;
const job = new CronJob(config.avatarsRefreshCron, async () => {
  const ids = (await knex('users').select(['id', 'user_id'])).filter(v => v.user_id);
  const avatarsPath = path.join(dataPath, 'public', 'avatars');
  if (!fs.existsSync(avatarsPath)) {
    fs.mkdirSync(avatarsPath);
  }
  await saveAllAvatars(ids);
});
job.start();

if (!process.env.WEBHOOK_PATH?.length > 0) {
  bot.launch();
}