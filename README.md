# 🌍 Community Map Telegram Bot 🗺️

Welcome to **Community Map** – a Telegram bot and a website that helps you connect with people from the same community nearby! You simply write your city, and your Telegram profile appears on the map for others to discover. It’s an easy way to find like-minded people in your area. ✨

## 🚀 Features

* **Telegram**: Add your city via Telegram and see yourself on the map!
* **Interactive Map**: Find nearby users easily through a dynamic map interface.

## 🛠️ Tech Stack

* **Backend**: [Fastify](https://www.fastify.io/) – fast and low-overhead web framework.
* **Database**: [SQLite](https://sqlite.org/) with [knex.js](https://knexjs.org/) – SQL query builder.
* **Telegram Bot Framework**: [Telegraf](https://github.com/telegraf/telegraf) – modern Telegram bot framework.
* **Frontend**: Vanilla JS

## ⚙️ Installation & Setup

1. **Clone the repository**:

```bash
git clone https://github.com/174n/community-map.git
cd community-map
```

2. **Install dependencies**:

```bash
npm install
```

3. **Set up environment variables**:  

Create a `.env` file in the root directory with your bot's credentials.

```env
cp .env.example .env
```

4. **Run database migrations**:

```bash
npm run migrate
```

5. **Start the server**:

```bash
npm run dev
```

Your bot is now up and running! 🚀

## 🗺️ Usage

**Interact with the bot**:  

Start the bot on Telegram and send your city name. The bot will register your location and add you to the map. 🌐

**Check out the map**:  

Open the website (default on `localhost:8080`) to explore the map and find nearby community members. 💬

## 📂 Project Structure

```bash
community-map/
├── data                  # put geojsons there and adjust config.json
├── docker-compose.yml    # just to not to remember docker command
├── Dockerfile            # duh
├── frontend              # frontend 😲
├── LICENSE
├── package.json
├── package-lock.json
├── README.md
└── src                   # backend
```

## 📈 Roadmap

- [ ] Replace hardcoded stuff with configs
- [ ] Add I18N
- [ ] Add profile removal
- [ ] Add captcha to show username

## 🤝 Contributing

Contributions are welcome! Feel free to fork the project and submit a pull request. For major changes, please open an issue to discuss what you would like to change.

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/174n/community-map/blob/master/LICENSE) file for details.