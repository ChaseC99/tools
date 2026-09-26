import test from 'node:test';
import assert from 'node:assert/strict';
import encodeQR from 'qr';
import decodeQR from 'qr/decode.js';
import { describeQR } from './qrContent.mjs';

test('website actions expose the complete destination and preserve path casing', () => {
    const raw = '  HTTPS://Example.com/Path?q=Hello%20World#anchor\n';
    const result = describeQR(raw);
    assert.equal(result.type, 'Website');
    assert.equal(result.action.href, 'https://example.com/Path?q=Hello%20World#anchor');
    assert.equal(result.detail, result.action.href);
});

test('untrusted schemes, markup, malformed URLs and control characters remain text', () => {
    for (const value of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', 'file:///etc/passwd', 'intent://example', '<img src=x onerror=alert(1)>', 'https://', 'http://[invalid]', 'java\nscript:alert(1)', 'https://example.com/\u0000', 'mailto:', 'sms:%ZZ', 'WIFI:T:WPA;;', 'MECARD:NOTE:hello;;', 'hello', '']) {
        assert.equal(describeQR(value).action, undefined, value);
    }
});

test('contact cards are offered as files without modifying the card', () => {
    const card = 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Jane Doe\r\nTEL:+15555550123\r\nEND:VCARD';
    assert.deepEqual(describeQR(card).action, { kind: 'download', label: 'Add to contacts (.vcf)', content: card, mime: 'text/vcard', filename: 'contact.vcf' });
    assert.equal(describeQR('BEGIN:VCARD\nFN:Incomplete').action, undefined);
});

test('MECARD supports multiple numbers and escaped delimiters without injecting vCard fields', () => {
    const result = describeQR('MECARD:N:Doe,Jane;TEL:123;TEL:456;EMAIL:jane@example.com;NOTE:hello\\;world\nTEL:789;;');
    assert.match(result.action.content, /FN:Jane Doe\r\n/);
    assert.match(result.action.content, /TEL:123\r\nTEL:456\r\n/);
    assert.match(result.action.content, /NOTE:hello\\;world\\nTEL:789\r\n/);
});

test('Wi-Fi passwords unescape separators, colons and literal backslashes', () => {
    const result = describeQR(String.raw`WIFI:T:WPA;S:Office\;Guest;P:abc\;123\:456\\xyz;;`);
    assert.match(result.detail, /Office;Guest/);
    assert.equal(result.action.content, 'abc;123:456\\xyz');
    assert.equal(describeQR('WIFI:T:nopass;S:Guest;;').action.content, 'Guest');
    assert.equal(describeQR('WIFI:T:nopass;S:Guest;;').action.label, 'Copy network name');
});

test('email, telephone and SMS offer explicit app actions', () => {
    for (const [value, label] of [['mailto:jane@example.com?subject=Hello', 'Compose email'], ['tel:+15555550123', 'Call number'], ['sms:+15555550123?body=Hello', 'Compose message']]) {
        assert.deepEqual(describeQR(value).action, { kind: 'link', label, href: value });
    }
    assert.equal(describeQR('SMSTO:+15555550123:Hi & welcome: 👋').action.href, 'sms:+15555550123?body=Hi%20%26%20welcome%3A%20%F0%9F%91%8B');
});

test('locations validate coordinate bounds before offering a map', () => {
    assert.equal(describeQR('geo:37.7,-122.4').action.href, 'https://www.google.com/maps/search/?api=1&query=37.7%2C-122.4');
    assert.equal(describeQR('geo:0,0?q=1600%20Amphitheatre%20Parkway').action.href, 'https://www.google.com/maps/search/?api=1&query=1600%20Amphitheatre%20Parkway');
    for (const invalid of ['geo:91,0', 'geo:0,-181', 'geo:hello,world']) assert.equal(describeQR(invalid).action, undefined);
});

test('calendar events are wrapped in an importable calendar file', () => {
    const event = 'BEGIN:VEVENT\nDTSTART:20261001T120000Z\nSUMMARY:Lunch\nEND:VEVENT';
    const action = describeQR(event).action;
    assert.equal(action.filename, 'event.ics');
    assert.match(action.content, /^BEGIN:VCALENDAR\r\nVERSION:2.0/);
    assert.ok(action.content.includes(event));
    assert.match(action.content, /END:VCALENDAR$/);
});

test('the installed decoder round-trips exact QR text, including whitespace and Unicode', () => {
    for (const raw of ['https://example.com', '  hello\n世界 👋\n ', 'WIFI:T:WPA;S:Guest;P:password;;', 'BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Jane Doe\r\nEND:VCARD']) {
        const grid = encodeQR(raw, 'raw', { border: 4, scale: 6 });
        const width = grid.length;
        const data = new Uint8ClampedArray(width * width * 4);
        for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            data.fill(grid[y][x] ? 0 : 255, offset, offset + 3);
            data[offset + 3] = 255;
        }
        assert.equal(decodeQR({ width, height: width, data }, { timeLimit: 600 }), raw);
    }
});
