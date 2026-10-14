import { useEffect, useId, useState, type ReactNode } from "react";
import PasswordInput from "@tools/shared/PasswordInput";
import ContactFields from "./ContactFields";
import { QR_CONTENT_TYPES, type QRContentType, type QRDraft } from "./qrContent.mjs";

const icons: Record<QRContentType, ReactNode> = {
    website: <><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2" /><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" /></>,
    wifi: <><path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0" /><circle cx="12" cy="20" r=".6" /></>,
    contact: <><rect x="4" y="3" width="16" height="19" rx="2" /><path d="M9 3V1m6 2V1M8 18a4 4 0 0 1 8 0" /><circle cx="12" cy="10" r="3" /></>,
    email: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 6 9 7 9-7" /></>,
    sms: <path d="M21 14a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3Z" />,
    phone: <path d="M7 3H4a1 1 0 0 0-1 1c0 9.4 7.6 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a14 14 0 0 1-7-7l2-2Z" />,
    location: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    text: <path d="M4 6V3h16v3M12 3v18M8 21h8" />,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2m-8 3h2" /></>,
};

type FieldOptions = {
    kind?: string;
    placeholder?: string;
    optional?: boolean;
    wide?: boolean;
    hint?: string;
    options?: { value: string; label: string }[];
    list?: string;
};

export default function QRContentEditor({ type, draft, errors, onTypeChange, onChange }: {
    type: QRContentType;
    draft: QRDraft;
    errors: Record<string, string>;
    onTypeChange: (type: QRContentType) => void;
    onChange: (key: string, value: QRDraft[string]) => void;
}) {
    const id = useId();
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [timezones, setTimezones] = useState<string[]>(['UTC']);
    useEffect(() => {
        const supported = (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
        setTimezones([...new Set(['UTC', Intl.DateTimeFormat().resolvedOptions().timeZone, ...supported])]);
    }, []);

    const field = (key: string, label: string, options: FieldOptions = {}) => {
        const fieldId = `${id}-${type}-${key}`;
        const error = touched[`${type}-${key}`] ? errors[key] : undefined;
        const props = {
            id: fieldId,
            value: String(draft[key] ?? ''),
            required: !options.optional,
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => onChange(key, event.target.value),
            onBlur: () => setTouched(current => ({ ...current, [`${type}-${key}`]: true })),
            'aria-invalid': !!error,
            'aria-describedby': [error ? `${fieldId}-error` : '', options.hint ? `${fieldId}-hint` : ''].filter(Boolean).join(' ') || undefined,
        };
        return <div className={`ui-field${options.wide ? ' qr-content-wide' : ''}`} key={key}>
            <label className="ui-label" htmlFor={fieldId}>{label}{options.optional && <span className="ui-muted"> (optional)</span>}</label>
            {options.kind === 'textarea'
                ? <textarea {...props} className="ui-textarea qr-content-textarea" placeholder={options.placeholder} />
                : options.options
                    ? <select {...props} className="ui-select">{options.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                    : options.kind === 'password'
                        ? <PasswordInput {...props} autoComplete="off" placeholder={options.placeholder} />
                        : <input {...props} className="ui-input" type={options.kind ?? 'text'} placeholder={options.placeholder} list={options.list} />}
            {options.hint && <p className="ui-hint" id={`${fieldId}-hint`}>{options.hint}</p>}
            {error && <p className="qr-field-error" id={`${fieldId}-error`} role="alert">{error}</p>}
        </div>;
    };
    const phoneField = (optional = false) => field('phone', 'Phone number', { kind: 'tel', placeholder: '415 555 0100', optional, wide: type !== 'contact' });
    const emailField = (optional = false) => field('email', 'Email address', { kind: 'email', placeholder: 'hello@example.com', optional, wide: type !== 'contact' });

    return <section className="qr-content-panel ui-panel ui-stack" aria-label="QR code content">
        <h2 id={`${id}-content-title`} className="qr-panel-title">Content</h2>
        <fieldset className="qr-type-picker" aria-labelledby={`${id}-content-title`}>
            <div className="qr-type-grid">
                {QR_CONTENT_TYPES.map(option => <label className="qr-type-option" key={option.id}>
                    <input className="ui-sr-only" type="radio" name={`${id}-type`} value={option.id}
                        checked={type === option.id} onChange={() => onTypeChange(option.id)} />
                    <span className="qr-type-tile">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{icons[option.id]}</svg>
                        <span>{option.label}</span>
                        <svg className="qr-type-check" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>
                    </span>
                </label>)}
            </div>
        </fieldset>

        <div className="qr-content-fields" key={type}>
            {type === 'website' && field('url', 'Website URL', { placeholder: 'https://example.com', wide: true, hint: 'A website, PDF, menu, social profile, or any public link.' })}
            {type === 'wifi' && <>
                {field('ssid', 'Network name', { placeholder: 'Studio Guest', wide: true })}
                {field('security', 'Security', { wide: true, options: [{ value: 'WPA', label: 'WPA / WPA2' }, { value: 'WEP', label: 'WEP' }, { value: 'nopass', label: 'No password' }] })}
                {draft.security !== 'nopass' && field('password', 'Password', { kind: 'password', wide: true })}
                <label className="ui-choice qr-content-wide"><input type="checkbox" checked={draft.hidden === true} onChange={event => onChange('hidden', event.target.checked)} />Hidden network</label>
                <p className="ui-hint qr-content-wide">Anyone with this QR code can read the network details.</p>
            </>}
            {type === 'contact' && <ContactFields draft={draft} errors={errors} onChange={onChange} />}
            {type === 'email' && <>
                {emailField()}
                {field('subject', 'Subject', { optional: true, wide: true })}
                {field('body', 'Message', { kind: 'textarea', optional: true, wide: true })}
            </>}
            {type === 'sms' && <>
                {phoneField()}
                {field('message', 'Message', { kind: 'textarea', optional: true, wide: true })}
            </>}
            {type === 'phone' && phoneField()}
            {type === 'location' && field('location', 'Address or coordinates', { placeholder: '123 Main Street, San Francisco', hint: 'Enter an address or a latitude, longitude pair.', wide: true })}
            {type === 'text' && field('text', 'Text', { kind: 'textarea', placeholder: 'Enter any text…', wide: true, hint: 'Preserves your text, including spaces and line breaks.' })}
            {type === 'calendar' && <>
                {field('title', 'Event title', { placeholder: 'Team meetup', wide: true })}
                <label className="ui-choice qr-content-wide"><input type="checkbox" checked={draft.allDay === true} onChange={event => onChange('allDay', event.target.checked)} />All-day event</label>
                {draft.allDay === true ? <>
                    {field('startDate', 'Start date', { kind: 'date' })}
                    {field('endDate', 'End date', { kind: 'date', hint: 'The last day of the event, included.' })}
                </> : <>
                    {field('start', 'Start', { kind: 'datetime-local' })}
                    {field('end', 'End', { kind: 'datetime-local' })}
                    {field('timezone', 'Timezone', { list: `${id}-timezones`, wide: true, hint: 'Dates and times use this timezone.' })}
                    <datalist id={`${id}-timezones`}>{timezones.map(zone => <option value={zone} key={zone} />)}</datalist>
                </>}
                {field('location', 'Location', { optional: true, wide: true })}
                {field('description', 'Description', { kind: 'textarea', optional: true, wide: true })}
            </>}
        </div>
    </section>;
}
