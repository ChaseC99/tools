import test from 'node:test';
import assert from 'node:assert/strict';
import qrcode from 'qrcode-generator';
import decodeQR from 'qr/decode.js';
import { buildQRContent, calendarInstant, createQRDrafts, QR_CONTENT_TYPES, setCalendarAllDay } from './qrContent.mjs';
import { createQRRenderer, getQRLayout } from './qrLogic.mjs';
import { describeQR } from '../qr-scanner/qrContent.mjs';

const event = {
    ...createQRDrafts().calendar,
    title: 'Team meetup', start: '2026-10-14T09:30', end: '2026-10-14T10:30',
    timezone: 'America/Los_Angeles', uid: 'event-123@tools', stamp: '20261014T120000Z',
};
const payload = (type, values) => buildQRContent(type, { ...createQRDrafts()[type], ...values });
const unfold = value => value.replace(/\r\n /g, '');

test('all nine types require meaningful content before generating a QR', () => {
    const drafts = createQRDrafts();
    assert.equal(QR_CONTENT_TYPES.length, 9);
    for (const { id } of QR_CONTENT_TYPES) {
        const result = buildQRContent(id, drafts[id]);
        assert.equal(result.data, '', id);
        assert.ok(Object.keys(result.errors).length, id);
    }
});

test('website URLs normalize while text preserves whitespace, protocols, and Unicode', () => {
    assert.equal(payload('website', { url: ' example.com/Path?a=1#x ' }).data, 'https://example.com/Path?a=1#x');
    for (const url of ['https://', 'javascript:alert(1)', 'not a website', 'http://example.com/\nATTACK']) {
        assert.equal(payload('website', { url }).data, '');
        assert.ok(payload('website', { url }).errors.url);
    }
    for (const text of ['  hello\n世界 👋\n ', ' ', 'example.com', 'mailto:hi@example.com']) assert.equal(payload('text', { text }).data, text);
});

test('Wi-Fi preserves significant spaces and escapes all delimiters without changing passwords', () => {
    const ssid = ' Studio; Guest: "one",\\二 ';
    const password = ' a;b:c,"d"\\123 ';
    const result = payload('wifi', { ssid, password, hidden: true });
    assert.match(result.data, /H:true;;$/);
    assert.equal(describeQR(result.data).action.content, password);
    assert.ok(describeQR(result.data).detail.includes(ssid));
    const open = payload('wifi', { ssid: 'Guest', password: 'old password', security: 'nopass' });
    assert.equal(open.data, 'WIFI:T:nopass;S:Guest;H:false;;');
    assert.equal(payload('wifi', { ssid: 'Guest' }).data, '');
});

test('contact text cannot inject properties and optional fields validate when present', () => {
    const result = payload('contact', { firstName: 'Zoë', lastName: '王;Doe', company: 'Studio, Inc.\nTEL:999', jobTitle: 'Designer, Lead; UX\nTEL:999', address: '1 Main; Suite 2', email: 'zoe@example.com', phone: '+1 (415) 555-0100', websites: ['example.com'] });
    assert.equal(describeQR(result.data).type, 'Contact');
    assert.ok(result.data.includes('N:王\\;Doe;Zoë;;;'));
    assert.ok(result.data.includes('ORG:Studio\\, Inc.\\nTEL:999'));
    assert.ok(result.data.includes('TITLE:Designer\\, Lead\\; UX\\nTEL:999'));
    assert.ok(result.data.includes('ADR:;;1 Main\\; Suite 2;;;;'));
    assert.ok(result.data.includes('TEL:+14155550100'));
    assert.ok(result.data.includes('URL:https://example.com'));
    assert.ok(payload('contact', { lastName: 'Doe' }).data);
    assert.ok(!payload('contact', { firstName: 'Maya', jobTitle: '  ' }).data.includes('TITLE:'));
    assert.ok(payload('contact', { firstName: 'Maya', jobTitle: 'Designer' }).data.includes('TITLE:Designer\r\n'));
    assert.equal(payload('contact', { firstName: 'Jane', email: 'invalid' }).data, '');
});

test('contacts include every website in order, normalize URLs, and ignore empty rows', () => {
    const result = payload('contact', { firstName: 'Maya', websites: ['', ' example.com/portfolio ', '  ', 'https://example.org/about?lang=en#bio'] });
    assert.deepEqual(result.errors, {});
    assert.deepEqual(unfold(result.data).split('\r\n').filter(line => line.startsWith('URL:')), [
        'URL:https://example.com/portfolio', 'URL:https://example.org/about?lang=en#bio',
    ]);
    assert.ok(!payload('contact', { firstName: 'Maya', websites: [] }).data.includes('URL:'));
    assert.notEqual(createQRDrafts().contact.websites, createQRDrafts().contact.websites);
});

test('invalid contact websites report their row and prevent a partial contact QR', () => {
    for (const invalid of ['https://', 'javascript:alert(1)', 'not a website', 'https://example.com/\r\nTEL:999']) {
        const result = payload('contact', { firstName: 'Maya', websites: ['example.com', invalid, 'example.org'] });
        assert.equal(result.data, '');
        assert.deepEqual(Object.keys(result.errors), ['websites.1']);
    }
});

test('contact notes preserve Unicode and line breaks, escape properties, and fold safely', () => {
    const notes = '  Met at the studio, follow up; next week.\\Details\r\n' + '世界👋'.repeat(25) + '\nEND:VCARD\nTEL:999  ';
    const result = payload('contact', { firstName: 'Maya', notes });
    assert.deepEqual(result.errors, {});
    assert.ok(unfold(result.data).includes('NOTE:  Met at the studio\\, follow up\\; next week.\\\\Details\\n' + '世界👋'.repeat(25) + '\\nEND:VCARD\\nTEL:999  \r\n'));
    assert.equal(result.data.split('\r\nEND:VCARD').length, 2);
    assert.ok(!result.data.includes('\r\nTEL:999'));
    for (const line of result.data.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
    assert.equal(describeQR(result.data).action.content, result.data.trim());
    assert.ok(!payload('contact', { firstName: 'Maya', notes: ' \n ' }).data.includes('NOTE:'));
});

test('email and phone payloads encode reserved characters and reject injected destinations', () => {
    const result = payload('email', { email: 'hello+qr@example.com', subject: 'Hi & welcome?', body: 'First line\n世界 + # ?' });
    const url = new URL(result.data);
    assert.equal(decodeURIComponent(url.pathname), 'hello+qr@example.com');
    assert.equal(url.searchParams.get('subject'), 'Hi & welcome?');
    assert.equal(url.searchParams.get('body'), 'First line\n世界 + # ?');
    assert.equal(payload('phone', { phone: '+1 (415) 555-0100' }).data, 'tel:+14155550100');
    for (const phone of ['+1?body=evil', '++12345', '...', '12', '+1234567890123456']) assert.equal(payload('phone', { phone }).data, '');
    for (const email of ['bad', 'a@example.com?subject=evil', 'a@example.com\nBcc:b@example.com']) assert.equal(payload('email', { email }).data, '');
});

test('multiline SMS messages round-trip to a safe compose action', () => {
    const message = 'Hello & welcome: 👋\nSecond line';
    const result = payload('sms', { phone: '+1 (415) 555-0100', message });
    assert.equal(describeQR(result.data).type, 'SMS');
    assert.equal(new URL(describeQR(result.data).action.href).searchParams.get('body'), message);
});

test('phone and SMS accept local numbers without a country code', () => {
    assert.deepEqual(payload('phone', { phone: '(415) 555-0100' }), { data: 'tel:4155550100', errors: {} });
    assert.deepEqual(payload('sms', { phone: '020 7946 0958', message: 'Hello' }), { data: 'SMSTO:02079460958:Hello', errors: {} });
});

test('map searches encode addresses and validate coordinate ranges', () => {
    const address = 'Main & 1st, San Francisco';
    assert.equal(new URL(payload('location', { location: address }).data).searchParams.get('query'), address);
    assert.ok(payload('location', { location: '37.7, -122.4' }).data);
    for (const location of ['91, 0', '0, -181']) assert.ok(payload('location', { location }).errors.location);
});

test('calendar timed events use the selected zone and include stable import metadata', () => {
    const result = payload('calendar', event);
    assert.deepEqual(result.errors, {});
    assert.match(result.data, /DTSTART:20261014T163000Z\r\nDTEND:20261014T173000Z/);
    assert.match(result.data, /UID:event-123@tools\r\nDTSTAMP:20261014T120000Z/);
    assert.equal(describeQR(result.data).type, 'Calendar event');
    assert.equal(payload('calendar', event).data, result.data);
    assert.equal(calendarInstant('2026-01-14T09:30', 'America/Los_Angeles').toISOString(), '2026-01-14T17:30:00.000Z');
    assert.equal(calendarInstant('2026-10-14T09:30', 'Asia/Kolkata').toISOString(), '2026-10-14T04:00:00.000Z');
});

test('calendar validation catches impossible dates, reversed ranges, invalid zones, and DST transitions', () => {
    assert.ok(payload('calendar', { ...event, start: '2026-02-30T09:30' }).errors.start);
    assert.ok(payload('calendar', { ...event, end: event.start }).errors.end);
    assert.ok(payload('calendar', { ...event, end: '2026-10-13T10:30' }).errors.end);
    assert.ok(payload('calendar', { ...event, timezone: 'Unknown/Zone' }).errors.timezone);
    assert.ok(payload('calendar', { ...event, timezone: '' }).errors.timezone);
    assert.throws(() => calendarInstant('2026-03-08T02:30', 'America/Los_Angeles'), /does not exist/);
    assert.throws(() => calendarInstant('2026-11-01T01:30', 'America/Los_Angeles'), /occurs twice/);
    assert.throws(() => calendarInstant('2026-10-04T02:15', 'Australia/Lord_Howe'), /does not exist/);
    assert.throws(() => calendarInstant('2026-04-05T01:45', 'Australia/Lord_Howe'), /occurs twice/);
});

test('all-day end dates are inclusive in the form and exclusive in the calendar', () => {
    const result = payload('calendar', { ...event, allDay: true, startDate: '2026-12-31', endDate: '2026-12-31', timezone: '' });
    assert.deepEqual(result.errors, {});
    assert.match(result.data, /DTSTART;VALUE=DATE:20261231\r\nDTEND;VALUE=DATE:20270101/);
    const leap = payload('calendar', { ...event, allDay: true, startDate: '2028-02-28', endDate: '2028-02-29' });
    assert.match(leap.data, /DTEND;VALUE=DATE:20280301/);
    assert.ok(payload('calendar', { ...event, allDay: true, startDate: '2026-10-14', endDate: '2026-10-13' }).errors.endDate);
});

test('switching event modes preserves dates, times, timezone, and import metadata', () => {
    const timed = { ...event, start: '2026-10-14T23:30', end: '2026-10-15T01:15' };
    const allDay = setCalendarAllDay(timed, true);
    assert.equal(allDay.startDate, '2026-10-14');
    assert.equal(allDay.endDate, '2026-10-15');
    assert.match(buildQRContent('calendar', allDay).data, /DTSTART;VALUE=DATE:20261014\r\nDTEND;VALUE=DATE:20261016/);
    const restored = setCalendarAllDay(allDay, false);
    assert.equal(buildQRContent('calendar', restored).data, buildQRContent('calendar', timed).data);
    assert.equal(restored.timezone, timed.timezone);
    assert.equal(restored.uid, timed.uid);
    assert.equal(timed.allDay, false);

    const rescheduled = setCalendarAllDay({ ...allDay, startDate: '2028-02-29', endDate: '2028-03-01' }, false);
    assert.equal(rescheduled.start, '2028-02-29T23:30');
    assert.equal(rescheduled.end, '2028-03-01T01:15');
    assert.deepEqual(buildQRContent('calendar', rescheduled).errors, {});
});

test('new all-day events retain their dates when switched to timed; cleared dates stay empty', () => {
    const initial = { ...createQRDrafts().calendar, ...event, start: '', end: '', allDay: true, startDate: '2026-12-31', endDate: '2026-12-31' };
    const timed = setCalendarAllDay(initial, false);
    assert.equal(timed.start.slice(0, 10), initial.startDate);
    assert.equal(timed.end.slice(0, 10), initial.endDate);
    assert.deepEqual(buildQRContent('calendar', timed).errors, {});
    assert.equal(setCalendarAllDay(timed, true).endDate, initial.endDate);

    const cleared = setCalendarAllDay({ ...setCalendarAllDay(event, true), endDate: '' }, false);
    assert.equal(cleared.end, '');
    const empty = setCalendarAllDay(createQRDrafts().calendar, true);
    assert.equal(empty.startDate, '');
    assert.equal(empty.endDate, '');
    assert.equal(setCalendarAllDay(empty, false).start, '');
});

test('calendar escaping and UTF-8 folding preserve data without injecting event properties', () => {
    const description = '世界👋'.repeat(25) + '\nEND:VEVENT; a,b\\c';
    const result = payload('calendar', { ...event, title: 'Meet, greet; eat', description });
    for (const line of result.data.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
    assert.ok(unfold(result.data).includes('SUMMARY:Meet\\, greet\\; eat'));
    assert.ok(unfold(result.data).includes('DESCRIPTION:' + '世界👋'.repeat(25) + '\\nEND:VEVENT\\; a\\,b\\\\c'));
    assert.equal(result.data.split('\r\nEND:VEVENT').length, 2);
});

test('renderer bytes decode to exact Unicode payloads for all content formats', async () => {
    const samples = [
        payload('text', { text: '  Café 世界 👋\n ' }).data,
        payload('wifi', { ssid: '客人', password: '密碼🔑' }).data,
        payload('contact', { firstName: 'Zoë', lastName: '王', jobTitle: 'デザイナー', websites: ['example.com', 'example.org/portfolio'], notes: 'Met at the café 👋\nFollow up next week.' }).data,
        payload('sms', { phone: '+14155550100', message: 'Hello 👋\n世界' }).data,
        payload('calendar', { ...event, title: 'Café 世界 👋' }).data,
    ];
    class Renderer {
        update(options) { this.options = options; }
        async getRawData() {
            const qr = qrcode(0, 'M');
            qr.addData(this.options.data, 'Byte');
            qr.make();
            const count = qr.getModuleCount(), scale = 5, width = (count + 8) * scale;
            const pixels = new Uint8ClampedArray(width * width * 4).fill(255);
            for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y, x)) {
                for (let dy = 0; dy < scale; dy++) for (let dx = 0; dx < scale; dx++) {
                    const offset = (((y + 4) * scale + dy) * width + (x + 4) * scale + dx) * 4;
                    pixels.fill(0, offset, offset + 3);
                }
            }
            return new Blob([JSON.stringify({ count, decoded: decodeQR({ width, height: width, data: pixels }, { timeLimit: 1500 }) })]);
        }
    }
    const render = createQRRenderer(Renderer);
    for (const data of samples) {
        const result = JSON.parse(await (await render({ data })).text());
        assert.equal(result.decoded, data);
        assert.equal(result.count, getQRLayout(data, 1000, 'M').moduleCount);
    }
    assert.throws(() => getQRLayout('👋'.repeat(600), 1000, 'M'), /too long/);
});
