let Markup,
    util;

if (typeof util === 'undefined') {
    Markup = require('telegraf/markup');
    util = require('./util.js');
}

exports.year = (prefix, { _id = '' }) => {
    const cnt = 5;
    let tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    const year = tmr.getFullYear();
    let buttons = [];
    for (let i = 0; i < cnt; i++) {
        const val = year + i;
        buttons.push(Markup.callbackButton(val, (prefix || '') + val + '_' + _id));
    }
    return Markup.inlineKeyboard(buttons);
};

exports.month = (year, prefix, { _id = '' }) => {
    const cnt = 3;
    let tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    let date = new Date(Math.max(tmr, new Date(`${year}/1/1`)));
    let buttons = [];
    let arr = [];
    do {
        let month = date.getMonth();
        const val = month + '_' + _id;
        arr.push(Markup.callbackButton(util.getMonthName(month, true), (prefix || '') + val));
        date.setMonth(month + 1);
        if (arr.length === cnt) {
            buttons.push(arr);
            arr = [];
        }
    } while (date.getFullYear() === year);
    if (arr.length > 0) buttons.push(arr);
    return Markup.inlineKeyboard(buttons);
};

exports.date = (year, month, prefix, { _id = '' }) => {
    const cnt = 7;
    let date = new Date();
    date.setFullYear(year);
    date.setMonth(month);
    date.setDate(1);
    let tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    date = new Date(Math.max(tmr, date));
    let buttons = [];
    let arr = [];
    do {
        let d = date.getDate();
        const val = d + '_' + _id;
        arr.push(Markup.callbackButton(d + util.getDayAbbr(d), (prefix || '') + val));
        date.setDate(d + 1);
        if (arr.length === cnt) {
            buttons.push(arr);
            arr = [];
        }
    } while (date.getMonth() === month);
    if (arr.length > 0) buttons.push(arr);
    return Markup.inlineKeyboard(buttons);
};

exports.confirm = (prefix, { _id = '' }) => {
    return Markup.inlineKeyboard([
        Markup.callbackButton('Confirm', (prefix || '') + '_' + _id),
        Markup.callbackButton('Cancel', 'details_' + _id)
    ]);
};

exports.details = (commands, { _id = '' }) => {
    const cnt = 4;
    let buttons = [];
    let arr = [];
    commands.forEach((c) => {
        arr.push(Markup.callbackButton(util.capitalise(c), c + '_' + _id));
        if (arr.length >= cnt) {
            buttons.push(arr);
            arr = [];
        }
    });
    arr.length && buttons.push(arr);
    return Markup.inlineKeyboard(buttons);
};

exports.commands = (commandList, type) => {
    const keys = Object.keys(commandList);
    return Markup.keyboard(
        keys.filter((k) => !commandList[k].type || commandList[k].type === type)
            .map((k) => commandList[k].label),
        { columns: 3 }
    ).resize();
};

exports.events = (events, prefix) => {
    return Markup.inlineKeyboard((events).map((e) => {
        const label = e.date ? (e.date > new Date() ? 'to be ' : '') + 'held on' : 'created on';
        return [Markup.callbackButton(
            `[${e.name}] ${label} on ${util.formatReadableDate(new Date(e.date || e.createDate))}`, 
            prefix ? prefix + '_' + e._id : e._id
        )];
    }));
};