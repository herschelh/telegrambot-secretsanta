let admin, db;

const EVENT_ADDRESS = '/secretsanta_events';
const USER_ADDRESS = '/secretsanta_users';
const EVENT_USER_ADDRESS = '/secretsanta_participants';

if (typeof admin === 'undefined') {
    admin = require('firebase-admin');

    admin.initializeApp();
    db = admin.database();
}

const getEvent = function (_id) {
    return db.ref(`${EVENT_ADDRESS}/${_id}`).once('value');
};

exports.getEvent = function (_id) {
    return getEvent(_id).then((snap) => snap.val());
};

exports.addEvent = function (event) {
    const ref = db.ref(EVENT_ADDRESS);
    const eventRef = ref.push();
    event = Object.assign({}, event, {
        _id: eventRef.key,
    });
    eventRef.set(event);
    return event;
};

exports.deleteEvent = function (event) {
    return deleteParticipants(event).then(() => db.ref(`${EVENT_ADDRESS}/${event._id}`).remove() );
};

const updateEvent = exports.updateEvent = function (event, propName) {
    const ref = db.ref(`${EVENT_ADDRESS}/${event._id}`);
    const propRef = ref.child(propName);
    propRef.set(event[propName]);
    return ref.once('value').then((snap) => { return snap.val() });
};

exports.setEventDate = function (event) {
    const ref = db.ref(`${EVENT_ADDRESS}/${event._id}`);
    ref.child('year').remove().catch((e) => console.warn('!!! dataService.setEventDate remove year - ', e) );
    ref.child('month').remove().catch((e) => console.warn('!!! dataService.setEventDate remove month - ', e) );
    return updateEvent(event, 'date');
};


exports.setBudget = function (event) {
    const ref = db.ref(`${EVENT_ADDRESS}/${event._id}`);
    const update = (({ budget, currency }) => ({ budget, currency }))(event);
    ref.update(update);
    return ref.once('value').then((snap) => Object.assign({}, snap.val(), update));
};

exports.setEventDrawn = function (event) {
    const ref = db.ref(`${EVENT_ADDRESS}/${event._id}`);
    const update = {
        drawDate: new Date().getTime(),
        isDrawn: true,
    };
    ref.update(update);
    return ref.once('value').then((snap) => Object.assign({}, snap.val(), update));
};

exports.findEventsByUser = function (user, isCreatorOnly) {
    return findUserKey(user).then((userKey) => {
        const root = db.ref();
        const eventRef = root.child(EVENT_ADDRESS);
        let eventKeys = [];
        let events = [];
        const pushEventVal = (snap) => {
            if (eventKeys.includes(snap.key)) return;
            events.push(snap.val());
            eventKeys.push(snap.key);
        };
        let p = eventRef.orderByChild('createdBy').equalTo(userKey).once('value').then((snap) => snap.forEach(pushEventVal));
        if (isCreatorOnly) {
            return p.then(() => events);
        } else {
            const participantRef = root.child(EVENT_USER_ADDRESS);
            let ps = [p];
            return participantRef.orderByChild('user').equalTo(userKey).once('value').then((snap) => {
                updateUser({ _id: userKey, events: snap.numChildren() });
                snap.forEach((s) => {
                    const key = s.child('event').val();
                    if (eventKeys.includes(key)) return;
                    ps.push(getEvent(key).then(pushEventVal));
                });
                return;
            }).then(() => Promise.all(ps).then(() => events));
        }
    });
};

exports.findEventsByChatId = function (chatId) {
    const ref = db.ref(EVENT_ADDRESS);
    let events = [];
    return ref.orderByChild('chatId').equalTo(chatId).once('value').then((snap) => {
        snap.forEach((s) => { events.push(s.val()) });
        return events;
    });
};


const getUser = function (_id) {
    return db.ref(`${USER_ADDRESS}/${_id}`).once('value');
};

const getUserVal = exports.getUser = function(_id) {
    return getUser(_id).then((snap) => snap.val());
};

const doAddUser = function (user) {
    const ref = db.ref(USER_ADDRESS);
    const userRef = ref.push();
    const { id, username } = user;
    if (typeof(id || username) === 'undefined') return null;
    user = Object.assign({}, user, {
        _id: userRef.key,
        _tgid_tgusername: `${user.id}_${user.username || ''}`,
    });
    userRef.set(user);
    return user;
};

const findUserSnap = function (user) {
    const ref = db.ref(USER_ADDRESS);

    let keys = ['username', 'id'];
    doFindUser = () => {
        const key = keys.pop();
        if (typeof key === 'undefined') return Promise.resolve(null);
        if (typeof user[key] === 'undefined') return doFindUser();
        return ref.orderByChild(key).equalTo(user[key]).limitToFirst(1).once('value').then((snap) => {
            if (snap.exists()) {
                let userSnap;
                snap.forEach((s) => {
                    if (s.child(key).val() === user[key]) {
                        userSnap = s;
                    }
                });
                if (userSnap.exists()) return Promise.resolve(userSnap);
            }
            return doFindUser();
        });
    };

    return doFindUser();
};

const findUserKey = function (user) {
    return user._id ? Promise.resolve(user._id) : findUser(user).then((user) => user._id);
};

const findUserRef = exports.findUserRef = function (user) {
    return findUserSnap(user).then((snap) => { return snap.ref });
};

const findUser = exports.findUser = function (user) {
    return findUserSnap(user).then((snap) => { return snap.val() });
};

const doUpdateUser = function(user, snap) {
    snap.ref.update(user);
    user = Object.assign({}, snap.val(), user);
    return Promise.resolve(user);
};

const updateUser = exports.updateUser = function (user) {
    return findUserSnap(user).then((snap) => ((snap === null || !snap.exists()) ? doAddUser(user) : doUpdateUser(user, snap)) );
};

exports.addUser = function (user) {
    return findUserSnap(user).then((snap) => ((snap === null || !snap.exists()) ? doAddUser(user) : doUpdateUser(user, snap)) );
};

exports.findUsersByEvent = function (event) {
    return findParticipantsSnap(event).then((snap) => {
        const ref = db.ref(USER_ADDRESS);
        let refs = [];
        let users = [];
        snap.forEach((s) => {
            refs.push( ref.child(s.child('user').val()).once('value', (s) => users.push(s.val())) );
        });
        return Promise.all(refs).then(() => users).catch((e) => Promise.reject(e));
    });
};


exports.addParticipant = function (event, user) {
    return findUserKey(user).then((userKey) => {
        const eventKey = event._id;
        const root = db.ref();
        const ref = root.child(EVENT_USER_ADDRESS);
        return ref.orderByChild('_event_user').equalTo(`${eventKey}_${userKey}`).once('value')
            .then((snap) => {
                const doReturn = (i) => Object.assign({}, i, {
                    eventData: event,
                    userData: Object.assign({}, user, { _id: userKey })
                });
        
                if (snap.exists()) return Promise.resolve();
                const itemRef = ref.push();
                const item = {
                    _id: itemRef.key,
                    event: eventKey,
                    user: userKey,
                    joinDate: new Date().getTime(),
                    _event_user: `${eventKey}_${userKey}`,
                };
                return itemRef.set(item).then(() => {
                    root.child(EVENT_ADDRESS).child(eventKey).child('users').once('value', incr);
                    root.child(USER_ADDRESS).child(userKey).child('events').once('value', incr);
                    return doReturn(item);
                }).catch((e) => Promise.reject(e));
            });
    });
};

const findParticipantsSnap = function (event) {
    const eventKey = event._id;
    const ref = db.ref(EVENT_USER_ADDRESS);
    return ref.orderByChild('event').equalTo(eventKey).once('value');
};

const findParticipants = exports.findParticipants = function (event) {
    return findParticipantsSnap(event).then((snap) => {
        let items = [];
        snap.forEach((s) => { items.push(s.val()) });
        updateEvent(Object.assign({}, event, { users: snap.numChildren() || items.length }), 'users');
        return Promise.resolve(items);
    });
};

const findParticipantByRecipientSnap = exports.findParticipantByRecipientSnap = function (event, recipient) {
    const eventKey = event._id;
    return findUserKey(user).then((userKey) => {
        const root = db.ref();
        const ref = root.child(EVENT_USER_ADDRESS);
        return ref.orderByChild('_event_recipient').equalTo(`${eventKey}_${recipient}`).once('value');
    });
};

const getParticipantQuery = function (event, user) {
    const eventKey = event._id;
    return findUserKey(user).then((userKey) => {
        const root = db.ref();
        const ref = root.child(EVENT_USER_ADDRESS);
        return ref.orderByChild('_event_user').equalTo(`${eventKey}_${userKey}`);
    });
};

const getParticipantSnap = function (event, user) {
    return getParticipantQuery(event, user).then((query) => query.once('value'));
};

const getParticipant = exports.getParticipant = function (event, user) {
    return getParticipantSnap(event, user).then((s) => s.val());
};

const updateParticipant = exports.updateParticipant = function (participant, propName) {
    const ref = db.ref(`${EVENT_USER_ADDRESS}/${participant._id}`);
    const propRef = ref.child(propName);
    propRef.set(participant[propName]);
    let update = {};
    update[propName] = participant[propName];
    return ref.once('value').then((snap) => Object.assign({}, snap.val(), update));
};

exports.setParticipantRecipient = function (participant) {
    const ref = db.ref(`${EVENT_USER_ADDRESS}/${participant._id}`);
    const update = (({ event, recipient }) => ({ recipient, _event_recipient: `${event}_${recipient}` }))(participant);
    ref.update(update);
    return ref.once('value').then((snap) => Object.assign({}, snap.val(), update));
};

exports.getParticipantRecipient = function (event, user) {
    return getParticipantSnap(event, user).then((snap) => {
        let recipient;
        snap.exists() && snap.forEach((s) => recipient = s.child('recipient').val());
        return recipient ? getUserVal(recipient) : null;
    });
};

exports.deleteParticipant = function (event, user) {
    return getParticipantSnap(event, user).then((snap) => {
        if (!snap.exists()) return false;
        let refs = [];
        snap.forEach((s) => {
            const root = db.ref();
            const eventKey = s.child('event').val();
            const userKey = s.child('user').val();
            const recipient = s.child('recipient').val();
            recipient && findParticipantByRecipientSnap(event, userKey).then((snap) => snap.ref.update({ recipient }));
            root.child(EVENT_ADDRESS).child(eventKey).child('users').once('value', decr);
            root.child(USER_ADDRESS).child(userKey).child('events').once('value', decr);
            refs.push(s.ref.remove());
        });
        return Promise.all(refs).then(() => true).catch((e) => Promise.reject(e));
    });
};

const deleteParticipants = function (event) {
    const ref = db.ref(USER_ADDRESS);
    return findParticipantsSnap(event).then((snap) => {
        let refs = [];
        snap.forEach((s) => {
            const userKey = s.child('user').val();
            ref.child(userKey).child('events').once('value', decr);
            refs.push(s.ref.remove());
        });
        return Promise.all(refs);
    });
};


// util

const incr = (snap) => {
    let cnt = snap.exists() ? parseInt(snap.val()) : 0;
    snap.ref.set(cnt + 1);
};

const decr = (snap) => {
    let cnt = snap.exists() ? parseInt(snap.val()) : 1;
    snap.ref.set(Math.max(cnt - 1, 0));
};