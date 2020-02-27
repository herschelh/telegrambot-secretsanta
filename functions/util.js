const checkStr = (word) => (word && typeof word === 'string' && word.trim().length > 0);

const capitalise = exports.capitalise = (word) => {
	if (!checkStr(word)) return '';
	return (word[0] || '').toUpperCase() + word.slice(1);
};

const snakeToCamel = exports.snakeToCamel = (word) => {
	if (!checkStr(word)) return '';
    return word.replace(
        /([-_][a-z])/g,
        (group) => group.toUpperCase().replace('-', '').replace('_', '')
    );
};

const camelToSnake = exports.camelToSnake = (word) => {
	if (!checkStr(word)) return '';
    return word.replace(
        /([A-Z])/g,
        (group) => '_' + group.toLowerCase()
    );
};

exports.formatNumber = (num) => String(num).replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");

exports.formatReadableDate = (date) => {
    if(!date) return '';
    date = new Date(date);
	let mon = date.getMonth();
	let d = date.getDate();
	let m = getMonthName(mon);
	let y = date.getFullYear();
	return d + getDayAbbr(d) + ' ' + m + ' ' + y;
};

const monthList = [
	'january',
	'february',
	'march',
	'april',
	'may',
	'june',
	'july',
	'august',
	'september',
	'october',
	'november',
	'december',
];

const getMonthIndex = exports.getMonthIndex = (month) => {
	if (!checkStr(month)) return -1;
	let idx = -1;
	const monthShort = month.substr(0, 3);
	monthList.find((m, i) => {
		let found = m.substr(0, 3) === monthShort;
		if (found) idx = i;
		return found;
	})
	return idx;
};

const getMonthName = exports.getMonthName = (month, short) => {
	if (month instanceof Date) {
		month = month.getMonth();
	}
	const monthName = monthList[month];
	return capitalise(short ? monthName.substr(0, 3) : monthName);
};

const getDayAbbr = exports.getDayAbbr = (day) => {
	if (day instanceof Date) {
		day = day.getDate();
	}
	let abbr;
	const ten = Math.floor(day / 10);
	if(ten === 1) {
		abbr = 'th';
	} else {
		const one = day % 10;
		switch (one) {
			case 1:
				abbr = 'st';
				break;
			case 2:
				abbr = 'nd';
				break;
			case 3:
				abbr = 'rd';
				break;
			default:
				abbr = 'th';
				break;
		}
	}

	return abbr;
}