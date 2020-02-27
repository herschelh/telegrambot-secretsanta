let functions, bot, util,
	Telegraf, Extra, Session, 
	botService, keyboardService,
	botId, botName, commandList;

if (typeof bot === 'undefined') {
	
	functions = require('firebase-functions');
	Telegraf = require('telegraf');
	Extra = require('telegraf/extra');
	Session = require('telegraf/session');

	botService = require('./bot-service.js')
	keyboardService = require('./keyboard-service.js');

	util = require('./util.js');

	botId = functions.config().bot.id;
	botName = functions.config().bot.name;

	commandList = botService.commandList;
	
	// will require paid firebase plan or alternate hosting solution in order to make request to telegram
	// initiating telegraf with token calls /getMe
	// bot = new Telegraf(functions.config().bot.token);
	bot = new Telegraf();

	bot.use(Session());

	bot.use((ctx, next) => {
		const type = util.snakeToCamel(ctx.updateType);
		const { session, updateSubTypes } = ctx;
		let mw = [];
		mw.push(botService.logUser(ctx));
		session.event && mw.push(botService.selectEvent(ctx, session.event._id));
		switch (type) {
			case 'callbackQuery':
				break;
			case 'message':
				switch (true) {
					case updateSubTypes.includes('text'):
					case updateSubTypes.includes('new_chat_members'):
						break;
					default:
						console.log(`~ unhandled subtype ${type}.${updateSubTypes} ; returning 200`);
						botService.ok(ctx);
						break;
				}
				break;
			default:
				console.log(`~ unhandled type ${type} ; returning 200`);
				botService.ok(ctx);
				break;
		}
		return Promise.all(mw).then(() => next());
	});

	bot.start((ctx) => ctx.chat.type === 'private' 
		? ctx.reply(`Hello ${ctx.message.from.first_name}`, Extra.markup(keyboardService.commands(commandList, ctx.chat.type)))
		: botService.help(ctx)
	);

	bot.hears(/help/, (ctx) => botService.help(ctx));

	bot.hears([commandList.new.label, '/new', `/new@${botName}`], botService.new);

	bot.hears([commandList.date.label, '/date', `/date@${botName}`], botService.date);

	bot.hears([commandList.budget.label, '/budget', `/budget@${botName}`], botService.budget);

	bot.hears([commandList.details.label, '/details', `/details@${botName}`], botService.details);

	bot.hears([commandList.participants.label, '/participants', `/participants@${botName}`], botService.participants);

	bot.hears([commandList.join.label, '/join', `/join@${botName}`], botService.join);

	bot.hears([commandList.leave.label, '/leave', `/leave@${botName}`], botService.leave);

	bot.hears([commandList.delete.label, '/delete', `/delete@${botName}`], botService.delete);

	bot.hears([commandList.draw.label, '/draw', `/draw@${botName}`], botService.draw);

	bot.hears([commandList.name.label, '/name', `/name@${botName}`], botService.name);

	bot.hears([commandList.cancel.label, '/cancel', `/cancel@${botName}`], ({ session, reply }) => {
		if (session.currentCommand) {
			reply(`The command /${session.currentCommand.split(/[A-Z]/)[0]} has been cancelled.`);
			delete session.currentCommand;
			delete session.event;
		} else {
			reply('No active command to cancel.');
		}
	});

	bot.on('new_chat_members', (ctx) => {
		const { message: { new_chat_member: { id } } } = ctx;
		id === botId ? botService.help(ctx) : botService.ok(ctx);
	});

	bot.on('text', (ctx) => {
		const { 
			session = {}, message: { text }, reply_to_message: { text: replyTo } = { text: '' } 
		} = ctx;
		let { currentCommand } = session;
		const list = botService.messageList;
		switch (replyTo.toLowerCase()) {
			case list.new.toLowerCase():
				currentCommand = 'new';
				break;
		}
		if (currentCommand) {
			switch (currentCommand) {
				case 'new':
					botService.newEvent(ctx, { name: text });
					return;
			}
		}
		botService.ok(ctx);
	});

	bot.action(/.+/, (ctx) => {
		const { session = {}, match } = ctx;
		const { event } = session;
		const arr = match[0].split('_');
		const cmd = arr.length > 1 && arr.shift();
		const currentCommand = cmd && (cmd.match(/^[a-zA-Z]+/) || [])[0] || session.currentCommand;
		const getDateVal = () => {
			const m = cmd && cmd.match(/\d+$/);
			return m && m.length > 0 ? parseInt(m[0]) : null;
		};
		if (currentCommand) {
			const eventKey = arr.join('_');
			(event || !eventKey ? Promise.resolve() : botService.selectEvent(ctx, eventKey)).then(() => {
				event || !eventKey || console.log('===action event selected - ', ctx.session.event);
				switch (currentCommand) {
					case 'date':
						botService.dateEvent(ctx);
						return;
					case 'dateYear':
						botService.eventYear(ctx, getDateVal());
						return;
					case 'dateMonth':
						botService.eventMonth(ctx, getDateVal());
						return;
					case 'dateDate':
						botService.eventDate(ctx, getDateVal());
						return;
					case 'budget':
						botService.budgetEvent(ctx);
						return;
					case 'participants':
						botService.participantsEvent(ctx);
						return;
					case 'details':
						botService.detailsEvent(ctx);
						return;
					case 'join':
						botService.joinEvent(ctx);
						return;
					case 'leave':
						botService.leaveEvent(ctx);
						return;
					case 'leaveEvent':
						botService.leaveEvent(ctx, true);
						return;
					case 'delete':
						botService.deleteEvent(ctx);
						return;
					case 'deleteEvent':
						botService.deleteEvent(ctx, true);
						return;
					case 'draw':
						botService.drawEvent(ctx);
						return;
					case 'drawEvent':
						botService.drawEvent(ctx, true);
						return;
					case 'name':
						botService.nameEvent(ctx);
						return;
					default:
						botService.error(ctx, `Unhandled action *${val}* for command *${currentCommand}*`);
						break;
				}
				return;
			}).catch((e) => {
				botService.error(ctx);
				delete session.currentCommand;
				console.warn('!!! ERROR bot.action -', e)
			});
		} else {
			botService.ok(ctx);
		}
	});

}

exports.bot = functions.https.onRequest((req, res) => bot.handleUpdate(req.body, res));