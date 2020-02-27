# telegrambot-secretsanta
Secret Santa Telegram bot using Telegraf framework and Firebase Cloud Functions on Spark plan

## Bot functions
`/help` - shows a list of commands
`/new` - create new event
`/details` - view details of an event created by the user who initiated this command
`/participants` - view participants of an event
`/date` - set the date for an event
`/name` - get the user's drawn name for an event
`/join` - join an event
`/leave` - leave an event
`/delete` - delete an event that you have created
`/draw` - draw names for an event
`/cancel` - cancel active command

## Notes
This bot was developed around the limitation from a Spark (free) plan without billing account configured
```
Billing account not configured. External network is not accessible and quotas are severely limited. Configure billing account to remove these restrictions
```


## Development setup

### Local environment
1. Create project in [firebase console](https://console.firebase.google.com)

2. Use [npm](https://nodejs.org/en/) to install firebase CLI
```
npm install -g firebase-tools
```

3. Login firebase
```
firebase login
```

4. Init npm in project folder
```
npm init
```

5. Init firebase in project folder and choose
- **Database: Deploy Firebase Realtime Database Rules** and **Functions: Configure and deploy Cloud Functions** 
- The firebase project for this app
- Javascript
- ESLint: Yes
- Install dependencies: Yes
```
firebase init
```

6. Install dependencies ([Telegraf](https://github.com/telegraf/telegraf)) in **functions** folder
```
cd functions
npm install --save telegraf
```

### Telegram bot
1. Message [@BotFather](http://t.me/BotFather) and follow his instructions to create a new bot

2. Call [Telegram Bot API](https://core.telegram.org/bots/api#making-requests) to [set webhook](https://core.telegram.org/bots/api#setwebhook)
```
https://api.telegram.org/bot[Bot Token from BotFather]/setWebhook?url=[function URL from Firebase]
```