# telegrambot-secretsanta
Secret Santa Telegram bot using Telegraf framework and Firebase Cloud Functions on Spark plan

## Bot functions
- `/help` - shows a list of commands
- `/new` - create new event
- `/details` - view details of an event created by the user who initiated this command
- `/participants` - view participants of an event
- `/date` - set the date for an event
- `/name` - get the user's drawn name for an event
- `/join` - join an event
- `/leave` - leave an event
- `/delete` - delete an event that you have created
- `/draw` - draw names for an event
- `/cancel` - cancel active command

### Bot Usage
1. Add bot to group
2. Create `/new` event, bot will prompt:
    - for an event name
    - to select a year for event date
    - to select a month for event date
    - to select a day of the month for event date
3. `/join` an event, bot will list _upcoming_ events _created in the group_ as inline keyboard for user selection
4. `/draw` names, bot will list _upcoming_ events _created in the group_ that do _not yet have names drawn_ as inline keyboard for user selection
5. PM the bot and get drawn `/name`, bot will list _user joined_ or _user created_ events that _already have names drawn_ as inline keyboard for user selection

### FAQ
Q: Can I get people outside of the group to join the event?
A: Yes, in a group with intended participant, add the bot and run command `/details`, there will be an inline keyboard including a button for joining the event, the intended participant can then click that button to join.

Q: Can I have an event with X number of people?
A: There is only a minimum participant count set, as long as there are at least 3 participants in the event, names can be drawn.

Q: Can I leave an event after names are drawn?
A: Yes, as long as there will still be at least 3 participants in the event after, otherwise it is recommended to have the creator delete the event instead. After you leave, uour drawn name will be assigned to the participant who has drawn your name.

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