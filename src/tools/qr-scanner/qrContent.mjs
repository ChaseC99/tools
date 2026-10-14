/** @typedef {{kind: 'link', label: string, href: string} | {kind: 'download', label: string, content: string, mime: string, filename: string} | {kind: 'copy', label: string, content: string}} QRAction */
/** @typedef {{type: string, detail: string, action?: QRAction}} QRContent */

// Wi-Fi and MECARD fields use backslash escaping, including escaped semicolons.
function fields(value) {
    const result = new Map();
    for (const field of value.match(/(?:\\.|[^;])+/gs) ?? []) {
        const separator = field.indexOf(':');
        if (separator < 0) continue;
        const key = field.slice(0, separator).toUpperCase();
        const text = field.slice(separator + 1).replace(/\\([\\;,:"])/g, '$1');
        result.set(key, [...(result.get(key) ?? []), text]);
    }
    return result;
}

function vcardEscape(value) {
    return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/[,;]/g, '\\$&');
}

/** Classify content without changing the original payload or performing actions.
 * @param {string} raw
 * @returns {QRContent}
 */
export function describeQR(raw) {
    const value = raw.trim();
    const text = { type: 'Text', detail: 'No supported action was found. You can copy the raw data below.' };
    const contact = (content) => ({ type: 'Contact', detail: 'Download a contact card, then open it to review and add it to your contacts.',
        action: /** @type {QRAction} */ ({ kind: 'download', label: 'Add to contacts (.vcf)', content, mime: 'text/vcard', filename: 'contact.vcf' }) });

    if (/^BEGIN:VCARD\r?\n[\s\S]*\r?\nEND:VCARD$/i.test(value)) return contact(value);
    if (/^MECARD:/i.test(value)) {
        const data = fields(value.slice(7));
        if (!data.has('N') && !data.has('TEL') && !data.has('EMAIL')) return text;
        const name = data.get('N')?.[0] ?? '';
        const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardEscape(name.split(',').reverse().join(' '))}`];
        for (const key of ['TEL', 'EMAIL', 'ORG', 'NOTE', 'URL']) {
            for (const entry of data.get(key) ?? []) lines.push(`${key}:${vcardEscape(entry)}`);
        }
        lines.push('END:VCARD');
        return contact(lines.join('\r\n'));
    }
    if (/^WIFI:/i.test(value)) {
        const data = fields(value.slice(5));
        const ssid = data.get('S')?.[0];
        if (!ssid) return text;
        const password = data.get('P')?.[0];
        return { type: 'Wi-Fi', detail: `Network: ${ssid}. Join this network in your device’s Wi-Fi settings.`,
            action: { kind: 'copy', label: password ? 'Copy Wi-Fi password' : 'Copy network name', content: password || ssid } };
    }
    if (/^BEGIN:(?:VCALENDAR|VEVENT)\r?\n/i.test(value) && /\r?\nEND:(?:VCALENDAR|VEVENT)$/i.test(value)) {
        const content = /^BEGIN:VEVENT/i.test(value)
            ? `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Tools//QR Scanner//EN\r\n${value}\r\nEND:VCALENDAR` : value;
        return { type: 'Calendar event', detail: 'Download the event, then open it in your calendar to review and add it.',
            action: { kind: 'download', label: 'Add to calendar (.ics)', content, mime: 'text/calendar', filename: 'event.ics' } };
    }
    // SMSTO permits multiline text; encode its body before exposing a URI.
    const smsto = /^SMSTO:([^:]+)(?::([\s\S]*))?$/i.exec(value);
    if (smsto && /^[+\d(). -]+$/.test(smsto[1])) {
        return { type: 'SMS', detail: value, action: { kind: 'link', label: 'Compose message',
            href: `sms:${smsto[1]}${smsto[2] ? `?body=${encodeURIComponent(smsto[2])}` : ''}` } };
    }
    // Never pass arbitrary scanned schemes (javascript:, data:, file:, etc.) to a link.
    if (/[\u0000-\u001f\u007f]/.test(value)) return text;
    if (/^https?:\/\//i.test(value)) {
        try {
            const url = new URL(value);
            if (!url.hostname) return text;
            return { type: 'Website', detail: url.href, action: { kind: 'link', label: 'Open website', href: url.href } };
        } catch { return text; }
    }
    if (/^geo:/i.test(value)) {
        const match = /^geo:([-+]?\d+(?:\.\d+)?),([-+]?\d+(?:\.\d+)?)(?:[,;?].*)?$/i.exec(value);
        if (!match || Math.abs(Number(match[1])) > 90 || Math.abs(Number(match[2])) > 180) return text;
        const query = value.includes('?') ? new URLSearchParams(value.slice(value.indexOf('?') + 1)).get('q') : null;
        return { type: 'Location', detail: value, action: { kind: 'link', label: 'Open map',
            href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || `${match[1]},${match[2]}`)}` } };
    }
    for (const [scheme, type, label] of [['mailto', 'Email', 'Compose email'], ['tel', 'Phone number', 'Call number'], ['sms', 'SMS', 'Compose message']]) {
        if (!value.toLowerCase().startsWith(`${scheme}:`) || value.length <= scheme.length + 1) continue;
        try { decodeURIComponent(value); } catch { return text; }
        return { type, detail: value, action: { kind: 'link', label, href: scheme + value.slice(scheme.length) } };
    }
    return text;
}
