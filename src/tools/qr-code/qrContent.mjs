import { normalizeWebsiteUrl } from './qrLogic.mjs';

/** @typedef {'website'|'wifi'|'contact'|'email'|'sms'|'phone'|'location'|'text'|'calendar'} QRContentType */
/** @typedef {Record<string, string | boolean | string[]>} QRDraft */

/** @type {{id: QRContentType, label: string, action: string}[]} */
export const QR_CONTENT_TYPES = [
    { id: 'website', label: 'Website', action: 'Open a website' },
    { id: 'wifi', label: 'Wi-Fi', action: 'Offer to join a Wi-Fi network' },
    { id: 'contact', label: 'Contact', action: 'Offer to save a contact' },
    { id: 'email', label: 'Email', action: 'Compose an email' },
    { id: 'sms', label: 'SMS', action: 'Compose a text message' },
    { id: 'phone', label: 'Phone', action: 'Open the dialer' },
    { id: 'location', label: 'Location', action: 'Open a location in maps' },
    { id: 'text', label: 'Text', action: 'Display the text' },
    { id: 'calendar', label: 'Calendar event', action: 'Offer to add a calendar event' },
];

/** New objects per editor; passwords and other drafts stay in memory only. */
export function createQRDrafts() {
    return /** @type {Record<QRContentType, QRDraft>} */ ({
        website: { url: '' },
        wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
        contact: { firstName: '', lastName: '', phone: '', email: '', company: '', jobTitle: '', websites: [''], address: '', notes: '' },
        email: { email: '', subject: '', body: '' },
        sms: { phone: '', message: '' },
        phone: { phone: '' },
        location: { location: '' },
        text: { text: '' },
        calendar: { title: '', start: '', end: '', startDate: '', endDate: '', allDay: false, timezone: 'UTC', location: '', description: '', uid: '', stamp: '' },
    });
}

/** Switch modes using the displayed dates, retaining any previously entered times.
 * @param {QRDraft} draft @param {boolean} allDay @returns {QRDraft}
 */
export function setCalendarAllDay(draft, allDay) {
    if (draft.allDay === allDay) return draft;
    const next = { ...draft, allDay };
    for (const [key, defaultTime] of [['start', '09:00'], ['end', '10:00']]) {
        const timed = String(draft[key] ?? '');
        const dateKey = `${key}Date`;
        if (allDay) {
            next[dateKey] = timed.slice(0, 10);
        } else {
            const date = String(draft[dateKey] ?? '');
            const time = timed.split('T')[1] || defaultTime;
            next[key] = date ? `${date}T${time}` : '';
        }
    }
    return next;
}

const escapeText = (text) => text.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, '\\$&');
const escapeWifi = (text) => text.replace(/[\\;,:\"]/g, '\\$&');
const utcStamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');

// vCard/iCalendar lines are limited in bytes, without splitting a UTF-8 character.
function foldLine(line) {
    const encoder = new TextEncoder();
    let result = '', bytes = 0;
    for (const char of line) {
        const length = encoder.encode(char).length;
        if (bytes + length > 75) { result += '\r\n '; bytes = 1; }
        result += char;
        bytes += length;
    }
    return result;
}

function dateValue(value, allDay) {
    if (!(allDay ? /^\d{4}-\d{2}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/).test(value)) return null;
    const iso = allDay ? `${value}T00:00:00.000Z` : `${value}:00.000Z`;
    const date = new Date(iso);
    return Number.isFinite(date.getTime()) && date.toISOString() === iso ? date : null;
}

/** Convert wall time in an IANA zone to UTC, rejecting missing or repeated DST times. */
export function calendarInstant(value, timezone) {
    const date = dateValue(value, false);
    if (!date) throw new Error('Enter a valid date and time.');
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    const wallTime = (instant) => {
        const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, part.value]));
        return Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    };
    const target = date.getTime();
    const offsets = new Set();
    // Inspect either side of a timezone transition, including half-hour changes.
    for (const hours of [-48, -24, 0, 24, 48]) {
        const sample = target + hours * 3600000;
        offsets.add(wallTime(sample) - sample);
    }
    const matches = [...offsets].map(offset => target - offset).filter(instant => wallTime(instant) === target);
    if (!matches.length) throw new Error('This time does not exist because the clocks change. Choose another time.');
    if (matches.length > 1) throw new Error('This time occurs twice when the clocks change. Choose UTC and enter the intended UTC time.');
    return new Date(matches[0]);
}

/** @param {QRContentType} type @param {QRDraft} draft */
export function buildQRContent(type, draft) {
    /** @type {Record<string, string>} */
    const errors = {};
    const raw = (key) => typeof draft[key] === 'string' ? /** @type {string} */ (draft[key]) : '';
    const text = (key) => raw(key).trim();
    const required = (key, label) => {
        const value = text(key);
        if (!value) errors[key] = `Enter ${label}.`;
        return value;
    };
    const phone = (key, optional = false) => {
        const value = optional ? text(key) : required(key, 'a phone number');
        if (value && !/^\+?[\d(). -]+$/.test(value)) errors[key] = 'Use digits and an optional leading +.';
        const number = value.replace(/[(). -]/g, '');
        if (value && !/^\+?\d{3,15}$/.test(number)) errors[key] = 'Enter a valid phone number.';
        return number;
    };
    const email = (key, optional = false) => {
        const value = optional ? text(key) : required(key, 'an email address');
        if (value && !/^[^\s@,;:?<>]+@[^\s@,;:?<>]+\.[^\s@,;:?<>]+$/.test(value)) errors[key] = 'Enter one valid email address.';
        return value;
    };
    const website = (key, optional = false, input = text(key)) => {
        const value = input.trim();
        if (!value) {
            if (!optional) errors[key] = 'Enter a website URL.';
            return '';
        }
        const normalized = normalizeWebsiteUrl(value);
        try {
            const url = new URL(normalized);
            if (!['https:', 'http:'].includes(url.protocol) || !url.hostname || /[\s\u0000-\u001f]/.test(value)) throw new Error();
        } catch { errors[key] = 'Enter a valid http:// or https:// website URL.'; }
        return normalized;
    };
    let data = '';
    switch (type) {
        case 'website': data = website('url'); break;
        case 'text':
            data = raw('text');
            if (!data.length) errors.text = 'Enter some text.';
            break;
        case 'wifi': {
            // Spaces can be meaningful in both a network name and its password.
            const ssid = raw('ssid'), password = raw('password'), security = text('security');
            if (!ssid) errors.ssid = 'Enter a network name.';
            if (!['WPA', 'WEP', 'nopass'].includes(security)) errors.security = 'Choose a supported security type.';
            if (security !== 'nopass' && !password) errors.password = 'Enter the network password.';
            data = `WIFI:T:${security};S:${escapeWifi(ssid)};${security !== 'nopass' ? `P:${escapeWifi(password)};` : ''}H:${draft.hidden === true};;`;
            break;
        }
        case 'phone': data = `tel:${phone('phone')}`; break;
        case 'sms': data = `SMSTO:${phone('phone')}:${raw('message')}`; break;
        case 'email': {
            const address = email('email');
            const query = [['subject', raw('subject')], ['body', raw('body')]]
                .filter(([, value]) => value).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&');
            data = `mailto:${encodeURIComponent(address).replace(/%40/g, '@')}${query ? `?${query}` : ''}`;
            break;
        }
        case 'contact': {
            const first = text('firstName'), last = text('lastName');
            if (!first && !last) errors.firstName = 'Enter a first or last name.';
            const number = phone('phone', true), address = email('email', true);
            const websites = Array.isArray(draft.websites) ? draft.websites : [];
            const urls = websites.map((value, index) => website(`websites.${index}`, true, value)).filter(Boolean);
            const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:${escapeText(last)};${escapeText(first)};;;`, `FN:${escapeText([first, last].filter(Boolean).join(' '))}`];
            if (number) lines.push(`TEL:${number}`);
            if (address) lines.push(`EMAIL:${escapeText(address)}`);
            if (text('company')) lines.push(`ORG:${escapeText(text('company'))}`);
            if (text('jobTitle')) lines.push(`TITLE:${escapeText(text('jobTitle'))}`);
            for (const url of urls) lines.push(`URL:${url}`);
            if (text('address')) lines.push(`ADR:;;${escapeText(text('address'))};;;;`);
            if (text('notes')) lines.push(`NOTE:${escapeText(raw('notes'))}`);
            data = [...lines, 'END:VCARD', ''].map(foldLine).join('\r\n');
            break;
        }
        case 'location': {
            const location = required('location', 'an address or coordinates');
            const coordinates = /^([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)$/.exec(location);
            if (coordinates && (Math.abs(Number(coordinates[1])) > 90 || Math.abs(Number(coordinates[2])) > 180)) errors.location = 'Latitude must be −90 to 90; longitude must be −180 to 180.';
            data = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`;
            break;
        }
        case 'calendar': {
            const title = required('title', 'an event title');
            const allDay = draft.allDay === true;
            const startKey = allDay ? 'startDate' : 'start', endKey = allDay ? 'endDate' : 'end';
            const startValue = required(startKey, allDay ? 'a start date' : 'a start date and time');
            const endValue = required(endKey, allDay ? 'an end date' : 'an end date and time');
            let start = null, end = null;
            const timezone = text('timezone');
            if (!allDay) {
                try { new Intl.DateTimeFormat('en', { timeZone: timezone }); }
                catch { errors.timezone = 'Choose a valid timezone, such as America/Los_Angeles or UTC.'; }
            }
            for (const [key, value] of [[startKey, startValue], [endKey, endValue]]) {
                if (!value || errors.timezone) continue;
                try {
                    const date = allDay ? dateValue(value, true) : calendarInstant(value, timezone);
                    if (!date) throw new Error('Enter a valid date.');
                    if (key === startKey) start = date; else end = date;
                } catch (error) { errors[key] = error.message; }
            }
            if (start && end) {
                if (allDay ? end < start : end <= start) errors[endKey] = allDay ? 'The end date must be on or after the start date.' : 'The end must be after the start.';
                // The UI end date is inclusive; iCalendar DTEND is exclusive.
                if (allDay) {
                    end.setUTCDate(end.getUTCDate() + 1);
                    if (end.getUTCFullYear() > 9999) errors[endKey] = 'Choose an end date before December 31, 9999.';
                }
                const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Tools//QR Code//EN', 'BEGIN:VEVENT',
                    `UID:${escapeText(text('uid'))}`, `DTSTAMP:${text('stamp')}`,
                    allDay ? `DTSTART;VALUE=DATE:${utcStamp(start).slice(0, 8)}` : `DTSTART:${utcStamp(start)}`,
                    allDay ? `DTEND;VALUE=DATE:${utcStamp(end).slice(0, 8)}` : `DTEND:${utcStamp(end)}`,
                    `SUMMARY:${escapeText(title)}`];
                if (text('location')) lines.push(`LOCATION:${escapeText(text('location'))}`);
                if (raw('description')) lines.push(`DESCRIPTION:${escapeText(raw('description'))}`);
                data = [...lines, 'END:VEVENT', 'END:VCALENDAR', ''].map(foldLine).join('\r\n');
            }
            // Metadata is initialized once in the browser, keeping previews and exports identical.
            if (!text('uid') || !/^\d{8}T\d{6}Z$/.test(text('stamp'))) data = '';
            break;
        }
    }
    return { data: Object.keys(errors).length ? '' : data, errors };
}
