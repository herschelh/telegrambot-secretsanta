let functions, Extra, 
    dataService, keyboardService,
    util;

if (typeof functions === 'undefined') {
	functions = require('firebase-functions');
	Extra = require('telegraf/extra');
    dataService = require('./data-service.js');
    keyboardService = require('./keyboard-service.js');
    util = require('./util.js');
}

const botId = functions.config().bot.id;
const MIN_PARTICIPANTS = 3;
const commandList = exports.commandList = {
	new: {
		label: 'New event',
		desc: 'create new event',
	},
	details: {
		label: 'View event details',
        desc: 'view details of an event',
        groupDesc: 'view details of an event that you\'ve created',
	},
	participants: {
		label: 'View participants',
        desc: 'view participants of an event',
        inlineEvent: true,
	},
	date: {
		label: 'Set event date',
		desc: 'set the date for an event',
    },
	name: {
		label: 'Get drawn name',
		desc: 'get your drawn name for an event',
        type: 'private',
        inlineEvent: (event) => event.isDrawn,
	},
	join: {
		label: 'Join an event',
		desc: 'join an event',
		type: 'group',
        inlineEvent: ({ date, isDrawn }) => (!date || date > new Date().getTime()) && !isDrawn,
	},
	leave: {
		label: 'Leave an event',
		desc: 'leave an event',
        inlineEvent: ({ date, isDrawn, users = 0 }) => (!date || date > new Date().getTime()) && (!isDrawn || users > MIN_PARTICIPANTS),
	},
	delete: {
		label: 'Delete an event',
		desc: 'delete an event that you have created',
        inlineEvent: true,
    },
    draw: {
        label: 'Draw names',
        desc: 'draw names for an event',
        type: 'group',
        inlineEvent: ({ date, isDrawn, users = 0 }) => (!date || date > new Date().getTime()) && !isDrawn && users >= MIN_PARTICIPANTS,
    },
	cancel: {
		label: 'Cancel command',
		desc: 'cancel active command',
	},
};

const messageList = exports.messageList = {
    select: 'please select an event',
    new: 'please enter a name for the new event',
    eventDate: 'Setting date for',
    year: 'please choose a year:',
    month: 'please choose a month:',
    date: 'please choose a date:',
};

const replyMap = {
    error: ({
        reply, editMessageText, updateType, session: { currentCommand } = {}, chat: { type } = { type: 'group' }
    }, msg) => (updateType === 'message' ? reply : editMessageText)(
        msg || ('An error occured' + (currentCommand ? ` when processing command /${currentCommand.split(/[A-Z]/)[0]}.` : '.')),
        Extra.markdown().markup(updateType === 'message' 
            ? keyboardService.commands(commandList, type)
            : { reply_markup: JSON.stringify({ remove_keyboard: true }) } 
        )
    ),
    select: ({ reply, session: { currentCommand } = {} }, events, { emptyMsg, msg }) => {
        if (!events || events.length === 0) {
            reply(emptyMsg || 'No events found.');
            return;
        }
        reply(msg || util.capitalise(messageList.select), Extra.markdown().markup(keyboardService.events(events, currentCommand || '')));
    },
    new: ({ reply }) => reply(util.capitalise(messageList.new), { reply_markup: JSON.stringify({ force_reply: true }) }),
    newEvent: ({ reply, session: { currentCommand } = {} }, event, { createdMsg }) => reply(
        `${createdMsg || 'Created'} new event *${event.name}*\nLet's set a date for the event, ${messageList.year}`,
        Extra.markdown().markup(keyboardService.year(currentCommand, event))
    ),
    dateEvent: (
        { reply, editMessageText, updateType, session: { currentCommand, event } = {} }, { name }
    ) => (updateType === 'message' ? reply : editMessageText)(
        `${messageList.eventDate} *${name}*...\n${util.capitalise(messageList.year)}`,
        Extra.markdown().markup(keyboardService.year(currentCommand, event))
    ),
    dateYear: (
        { reply, editMessageText, updateType, session: { currentCommand, event } = {} }, { name, year }
    ) => (updateType === 'message' ? reply : editMessageText)(
        `${messageList.eventDate} *${name}*...\n*${year}* selected.\n${util.capitalise(messageList.month)}`,
        Extra.markdown().markup(keyboardService.month(year, currentCommand, event))
    ),
    dateMonth: (
        { reply, editMessageText, updateType, session: { currentCommand, event } = {} }, { name, year, month }
    ) => (updateType === 'message' ? reply : editMessageText)(
        `${messageList.eventDate} *${name}*...\n*${util.getMonthName(month, true)} ${year}* selected.\n${util.capitalise(messageList.date)}`,
        Extra.markdown().markup(keyboardService.date(year, month, currentCommand, event))
    ),
    dateDate: (
        { reply, editMessageText, updateType }, { name, date }
    ) => (updateType === 'message' ? reply : editMessageText)(
        `*${name}* set to be held on *${util.formatReadableDate(date)}*`, 
        Extra.markdown().markup({ reply_markup: JSON.stringify({ remove_keyboard: true }) })
    ),
    participantsEvent: (
        { reply, editMessageText, updateType, session: { event: { name } } }, users
    ) => (updateType === 'message' ? reply : editMessageText)(
        `There are ${users.length} participants for *${name}*` + (users.length > 0 ? ':' : '.') +
        users.reduce((str, u, idx) => '\n' + str + idx + '. ' + genUserTag(u), ''),
        Extra.markdown().markup(updateType === 'message' 
            ? keyboardService.commands(commandList, type)
            : { reply_markup: JSON.stringify({ remove_keyboard: true }) } 
        )
    ),
    leaveEvent: ({ 
        reply, editMessageText, updateType, session: { event, currentCommand } = { event: {} } 
    }) => (updateType === 'message' ? reply : editMessageText)(
        `Are you sure you want to leave event *${event.name}*? You won't be able to join again!`,
        Extra.markdown().markup(keyboardService.confirm(currentCommand, event))
    ),
    deleteEvent: ({ 
        reply, editMessageText, updateType, session: { event, currentCommand } = { event: {} } 
    }) => (updateType === 'message' ? reply : editMessageText)(
        `Are you sure you want to delete event *${event.name}*?`,
        Extra.markdown().markup(keyboardService.confirm(currentCommand, event))
    ),
    deleteEventConfirm: ({
        reply, editMessageText, updateType, session: { event: { name } } = { event: {} }
    }) => (updateType === 'message' ? reply : editMessageText)(
        `Successfully deleted event *${name}*`,
        Extra.markdown().markup(updateType === 'message'
            ? {}
            : { reply_markup: JSON.stringify({ remove_keyboard: true }) }
        )
    ),
    drawEvent: ({ 
        reply, editMessageText, updateType, session: { event, currentCommand } = { event: {} } 
    }) => (updateType === 'message' ? reply : editMessageText)(
        `Are you sure you want to draw names for event *${event.name}* now?`,
        Extra.markdown().markup(keyboardService.confirm(currentCommand, event))
    ),
    drawEventUnable: (ctx, msg) => { replyMap.error(
        ctx, `Unable to draw names for event *${ctx.session.event.name}*.\n${msg || ''}`
    )},
    drawEventConfirm: ({
        reply, editMessageText, updateType, session: { event: { name } } = { event: {} }, msg
    }) => (updateType === 'message' ? reply : editMessageText)(
        (msg || `Successfully drew names for event *${name}*`) +
        `, ${genBotTag()} for your drawn name!`,
        Extra.markdown().markup(updateType === 'message' 
            ? {} 
            : { reply_markup: JSON.stringify({ remove_keyboard: true }) }
        )
    ),
    nameGroup: (
        { reply, editMessageText, updateType, chat: { type } }
    ) => (updateType === 'message' ? reply : editMessageText)(
        `Let's not ruin the surprise, ${genBotTag()} for your drawn name!`,
        Extra.markdown().markup(updateType === 'message' 
            ? keyboardService.commands(commandList, type)
            : { reply_markup: JSON.stringify({ remove_keyboard: true }) } 
        )
    ),
    nameEvent: (
        { reply, editMessageText, updateType, session: { event: { name, date } } = { event: {} }, chat: { type } },
        user
    ) => (updateType === 'message' ? reply : editMessageText)(
        `You have drawn ${genUserTag(user)} for *${name}* ` +
        (date ? (date > new Date().getTime() ? 'to be ' : '') + `held on *${util.formatReadableDate(date)}*.` : ''),
        Extra.markdown().markup(updateType === 'message' 
            ? keyboardService.commands(commandList, type)
            : { reply_markup: JSON.stringify({ remove_keyboard: true }) } 
        )
    ),
    nameEventUnable: (
        { reply, editMessageText, updateType, session: { event: { name } }, chat: { type } }, { msg }
    ) => (updateType === 'message' ? reply : editMessageText)(
        `Unable to get your drawn name for event *${name}*.\n${msg || ''}`,
        Extra.markdown().markup(keyboardService.commands(commandList, type))
    ),
};

const genUserTag = ({ id, first_name, username }) => {
    let names = [];
    first_name && names.push(first_name);
    username && names.push('@' + username);
    const link = id ? `tg://user?id=${id}` : `http://t.me/${username}`;
    return `[${names.join(' ')}](${link})`;
};

const genBotTag = (label) => `[${label || 'PM me'}](tg://user?id=${botId})`;


const doSelect = (ctx, snap, type, cfg) => {
    const { session } = ctx;
    const { filter, emptyMsg, msg } = cfg || {};
    snap.then((events) => {
        events = filter && typeof filter === 'function' ? events.filter(filter) : events;
        replyMap.select(ctx, events, cfg || {});
        return;
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn(`!!! ERROR ${type || 'findEvents'} - `, e);
    });
};

const select = exports.select = (ctx, isCreatorOnly, cfg) => {
    const { session: { user }, message: { from } } = ctx;
    const snap = dataService.findEventsByUser(user || from, isCreatorOnly);
    doSelect(ctx, snap, 'findEventsByUser', Object.assign({}, isCreatorOnly && { 
        emptyMsg: 'Unable to find events created by ' + genUserTag(user || from),
        msg: 'Please select from this list of events created by ' + genUserTag(user || from),
    }, cfg));
};

const selectChat = exports.selectChat = (ctx, cfg) => {
    const { chat: { id: chatId } } = ctx;
    const snap = dataService.findEventsByChatId(chatId);
    doSelect(ctx, snap, 'findEventsByChatId', Object.assign({
        emptyMsg: 'Unable to find events that were created in this chat',
        msg: 'Please select from this list of events created in this chat',
    }, cfg));
};

exports.selectEvent = ({ session }, eventKey) => {
    return dataService.getEvent(eventKey).then((event) => session.event = event).catch((e) => {
        replyMap.error(ctx, 'The event you selected could not be found, please try again.');
        delete session.currentCommand;
        console.warn('!!! ERROR getEvent - ', e);
    });
};

exports.new = (ctx) => {
    const { session } = ctx;
    delete session.event;
    session.currentCommand = 'new';
    replyMap.new(ctx);
};

exports.newEvent = (ctx, event) => {
    const { message, session } = ctx;
    (session.user && session.user._id ? Promise.resolve() : logUser(ctx)).then(() => {
        let createdMsg = 'Created';
        let isDoJoin = false;
        event = Object.assign({}, event, {
            createdBy: session.user._id,
            createDate: message.date * 1000,
        });
        if (message.chat.type === 'group') {
            event = Object.assign({}, event, {
                chat: JSON.parse(JSON.stringify(message.chat)),
                chatId: message.chat.id,
            });
            createdMsg += ' and joined';
            isDoJoin = true;
        }
        session.event = event = dataService.addEvent(event);
        session.currentCommand = 'dateYear';
        if (isDoJoin) {
            dataService.addParticipant(event, session.user);
            event.users = 1;
        }
        replyMap.newEvent(ctx, event, { createdMsg });
        return true;
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR new event -', e, event);
    });
};

exports.date = (ctx) => {
    const { session, chat: { type } } = ctx;
    delete session.event;
    session.currentCommand = 'date';
    type === 'group' 
        ? selectChat(ctx, { 
            msg: 'Please select from this list of events created in this chat to set a date for', 
        }) 
        : select(ctx, false);
};

exports.dateEvent = (ctx) => {
    const { session = {} } = ctx;
    const { event } = session;
    if (!event) return select(ctx);
    session.currentCommand = 'dateYear';
    replyMap.dateEvent(ctx, event);
};

exports.eventYear = (ctx, val) => {
    const { session } = ctx;
    session.event = Object.assign({}, session.event, {
        year: val,
    });
    dataService.updateEvent(session.event, 'year').then(() => {
        session.currentCommand = 'dateMonth';
        return replyMap.dateYear(ctx, session.event);
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR set event year -', e, event);
    });
};

exports.eventMonth = (ctx, val) => {
    const { session } = ctx;
    session.event = Object.assign({}, session.event, {
        month: val,
    });
    dataService.updateEvent(session.event, 'month').then(() => {
        session.currentCommand = 'dateDate';
        return replyMap.dateMonth(ctx, session.event);
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR set event month -', e, event);
    });
};

exports.eventDate = (ctx, val) => {
    const { session } = ctx;
    const { event } = session;
    const { year, month } = event;
    let date = new Date();
    date.setFullYear(year);
    date.setMonth(month);
    date.setDate(val);
    delete event.year;
    delete event.month;
    session.event = Object.assign({}, event, {
        date: date.getTime(),
    });
    dataService.setEventDate(session.event).then(() => {
        delete session.currentCommand;
        replyMap.dateDate(ctx, session.event);
        return;
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR eventDate -', e);
    });
};
exports.details = (ctx) => {
    const { session, chat: { type } } = ctx;
    delete session.event;
    session.currentCommand = 'details';
    select(ctx, type === 'group');
};

const detailsEvent = exports.detailsEvent = (ctx, message, users) => {
    const { session = {}, reply, editMessageText, updateType, chat: { type } } = ctx;
    const { event } = session;
    if (!event || !event._id) return select(ctx);
    dataService.getUser(event.createdBy).then((createdBy) => {
        const created = createdBy && (createdBy.first_name || ('@' + createdBy.username));
        const { 
            name, date, chat, 
            createDate, users: cnt = (users || []).length, 
            isDrawn, drawDate
        } = event;
        const commands = Object.keys(commandList).filter((k) => 
            (!commandList[k].type || commandList[k].type === type) &&
            (typeof commandList[k].inlineEvent === 'function'
                ? commandList[k].inlineEvent(event)
                : commandList[k].inlineEvent)
        );
        const func = (updateType === 'message' ? reply : editMessageText);
        func(
            (message ? message : '') +
            `*${name}*\n` +
            (date ? `Event date: *${util.formatReadableDate(date)}*\n` : '') +
            (chat ? `Group: *${chat.title}*\n` : '') +
            `${cnt} participant${cnt === 1 ? '' : 's'}` +
            (users && users.length > 0
                ? ':' + users.reduce((str, u, idx) => str + '\n' + (idx + 1) + '. ' + genUserTag(u), '')
                : ''
            ) + '\n' +
            (isDrawn ? `Names drawn on *${util.formatReadableDate(drawDate)}* ` + 
                (type === 'group' ? `, ${genBotTag()} for your drawn name!` : '') + '\n' 
            : '') +
            `Created on *${util.formatReadableDate(createDate)}*` +
            (created ? ` by *${created}*` : ''),
            Extra.markdown().markup(keyboardService.details(commands, event))
        );
        delete session.currentCommand;
        return;
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR detailsEvent -', e);
    });
};

exports.participants = (ctx) => {
    const { session, chat: { type } } = ctx;
    delete session.event;
    session.currentCommand = 'participants';
    type === 'group' ? selectChat(ctx) : select(ctx);
};

exports.participantsEvent = (ctx) => {
    const { session = {} } = ctx;
    const { event } = session;
    dataService.findUsersByEvent(event).then((users) => {
        detailsEvent(ctx, undefined, users);
        delete session.currentCommand;
        return;
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR findUsersByEvent -', e);
    });
};

exports.join = (ctx) => {
    const { session, chat: { type } } = ctx;
    delete session.event;
    session.currentCommand = 'join';
    const filter = commandList.join.inlineEvent;
    type === 'group' ? selectChat(ctx, { filter }) : select(ctx, false, { filter });
};

exports.joinEvent = (ctx) => {
    const { session = {}, chat: { type } } = ctx;
    const { event, user } = session;
    dataService.addParticipant(event, user).then((item) => {
        let msg = 'already ';
        if (item) {
            session.event = Object.assign({}, event, { users: (event.users || 0) + 1 });
            session.user = Object.assign({}, user, { events: (user.events || 0) + 1 });
            msg = '';
        }
        detailsEvent(ctx, type === 'group' 
            ? `${genUserTag(user)} has ${msg}joined ` 
            : `You've ${msg}joined `
        );
        delete session.currentCommand;
        return;
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR addParticipant -', e);
    });
};

exports.leave = (ctx) => {
    const { session, chat: { type } } = ctx;
    delete session.event;
    session.currentCommand = 'leave';
    const filter = commandList.leave.inlineEvent;
    type === 'group' ? selectChat(ctx, { filter }) : select(ctx, false, { filter });
};

exports.leaveEvent = (ctx, isDoLeave) => {
    const { session = {}, chat: { type } } = ctx;
    const { event, user } = session;
    const { isDrawn, date, users } = event;
    if (date && date < new Date().getTime())
        return replyMap.error(ctx, `It's already past the scheduled date for *${event.name}*!`);
    if (isDrawn) {
        if (users <= MIN_PARTICIPANTS)
            return replyMap.error(ctx, 
                `There ${users === 1 ? 'is' : 'are'} only ${users} participant${users === 1 ? '' : 's'} for *${event.name}*, ` +
                `an event must have at least ${MIN_PARTICIPANTS} participants. \nMay I suggest deleting the event instead?`
            );
        if (!isDoLeave) {
            session.currentCommand = 'leaveEvent';
            return replyMap.leaveEvent(ctx);
        }
    }
    dataService.deleteParticipant(event, user).then((existed) => {
        let verb = {
            group: ' is',
            default: '\'re',
        };
        let msg = ' not in ';
        if (existed) {
            session.event = Object.assign({}, event, { users: Math.max(0, (event.users || 1) - 1) });
            session.user = Object.assign({}, user, { events: Math.max(0, (user.events || 1) - 1) });
            verb = {
                group: ' has',
                default: '\'ve',
            };
            msg = ' left ';
        }
        detailsEvent(ctx, 
            (type === 'group' ? genUserTag(user) + verb[type] : 'You' + verb.default) + msg
        );
        delete session.currentCommand;
        return;
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR deleteParticipant -', e);
    });
};

exports.delete = (ctx) => {
    const { session } = ctx;
    delete session.event;
    session.currentCommand = 'delete';
    select(ctx, true);
};

exports.deleteEvent = (ctx, isForceDelete) => {
    const { session } = ctx;
    const { event } = session;
    if (!isForceDelete) {
        session.currentCommand = 'deleteEvent';
        return replyMap.deleteEvent(ctx);
    }
    dataService.deleteEvent(event).then(() => {
        replyMap.deleteEventConfirm(ctx);
        delete session.currentCommand;
        delete session.event;
        return;
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR deleteEvent -', e)
    });
};

exports.draw = (ctx) => {
    const { session, chat: { type } = { type: 'group' } } = ctx;
    delete session.event;
    session.currentCommand = 'draw';
    const filter = commandList.draw.inlineEvent;
    type === 'group' ? selectChat(ctx, { filter,
        emptyMsg: 'Unable to find events that were created in this chat for drawing names',
    }) : select(ctx, true, { filter,
        emptyMsg: 'Unable to find events, that you\'ve created, for drawing names',
    });
};

exports.drawEvent = (ctx, isDoDraw) => {
    const { session } = ctx;
    const { event } = session;
    const { isDrawn, date, users } = event;
    if (isDrawn) 
        return replyMap.drawEventConfirm(ctx, 'Names have already been drawn.');
    if (date && date < new Date().getTime())
        return replyMap.drawEventUnable(ctx, 'It\'s already past the event\'s scheduled date!');
    if (!users || users < MIN_PARTICIPANTS)
        return replyMap.drawEventUnable(ctx, 
            `There ${users === 1 ? 'is' : 'are'} only ${users} participant${users === 1 ? '' : 's'}, ` +
            `let's get more people to join first.`
        );
    if (!isDoDraw) {
        session.currentCommand = 'drawEvent';
        return replyMap.drawEvent(ctx);
    }
    dataService.findParticipants(event).then((participants) => {
        if (participants.length < MIN_PARTICIPANTS)
            return Promise.reject(new Error('less than 3 participants found ' + JSON.stringify(participants)));
        const startingPool = participants.map((p) => p.user);
        let drawMap;
        const doDraw = () => {
            drawMap = {};
            let pool = [].concat(startingPool);
            participants.find((p) => {
                let indices = [];
                pool.forEach((r, idx) => r === p.user || (p.exclude && p.exclude.includes(r)) || indices.push(idx));
                let cnt = indices.length;
                let draw;
                switch (cnt) {
                    case 0:
                        doDraw();
                        return true;
                    case 1:
                        draw = 0;
                        break;
                    default: {
                        draw = Math.floor(Math.random() * cnt);
                        break;
                    }
                }
                drawMap[p._id] = pool.splice(indices[draw], 1)[0];
            });
            return;
        };
        doDraw();
        return Promise.all(participants.map((p) => 
            dataService.setParticipantRecipient(Object.assign({}, p, { recipient: drawMap[p._id] }))
        )).then(() => {
            dataService.setEventDrawn(event);
            delete session.currentCommand;
            replyMap.drawEventConfirm(ctx);
            return;
        });
    }).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR drawEvent -', e)
    });
};

exports.name = (ctx) => {
    const { session, chat: { type } = { type: 'group' } } = ctx;
    delete session.event;
    session.currentCommand = 'name';
    const filter = commandList.name.inlineEvent;
    type === 'group' ? replyMap.nameGroup(ctx) : select(ctx, false, { filter });
};

exports.nameEvent = (ctx) => {
    const { session, chat: { type } = { type: 'group' } } = ctx;
    if (type === 'group') return replyMap.nameGroup(ctx);
    const { event, user } = session;
    if (!event.isDrawn) return replyMap.error(ctx, `Names have not been drawn for *${event.name}* yet!`);
    dataService.getParticipantRecipient(event, user).then((recipient) => recipient === null
        ? replyMap.error(ctx, `Hey ${genUserTag(user)}, it looks like you haven't joined *${event.name}* yet!`)
        : replyMap.nameEvent(ctx, recipient)
    ).catch((e) => {
        replyMap.error(ctx);
        delete session.currentCommand;
        console.warn('!!! ERROR nameEvent -', e)
    });
};


exports.help = (ctx) => {
    const { reply, chat: { type } = { type: 'group' } } = ctx;
    reply(
        'Create an event, set a date, get friends to join your event, and you\'re ready to draw names!\n' +
        Object.keys(commandList).reduce((str, k) => {
            const item = commandList[k];
            return (!item.type || item.type === type) ? `${str}/${k} - ${item[type + 'Desc'] || item.desc}\n` : str;
        }, ''),
		Extra.markdown().markup(keyboardService.commands(commandList, type))
    );
};

exports.error = replyMap.error;

exports.ok = ({ tg: { response: res } = {} }) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('okay');
};

const logUser = exports.logUser = ({ session, from: user }) => {
    if (user && (!session.user || !session.user._id || session.user.id !== user.id)) {
        delete session.user;
        return dataService.addUser(user)
            .then((user) => (session.user = user))
            .catch((e) => console.warn('!!! ERROR in add user -', e));
    }
    return Promise.resolve();
};

exports.logSticker = ({ message: { sticker } = {} }) => dataService.addSticker(sticker);
