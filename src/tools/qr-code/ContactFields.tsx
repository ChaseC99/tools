import { useEffect, useId, useRef, useState, type HTMLInputTypeAttribute } from "react";
import type { QRDraft } from "./qrContent.mjs";

type FieldOptions = {
    type?: HTMLInputTypeAttribute;
    autoComplete?: string;
    hint?: string;
    rows?: number;
};

export default function ContactFields({ draft, errors, onChange }: {
    draft: QRDraft;
    errors: Record<string, string>;
    onChange: (key: string, value: QRDraft[string]) => void;
}) {
    const id = useId();
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const websites = Array.isArray(draft.websites) && draft.websites.length ? draft.websites : [''];
    // Keep row identity, validation, and focus attached to the same website after removal.
    const [websiteIds, setWebsiteIds] = useState(() => websites.map((_, index) => index));
    const nextWebsiteId = useRef(websites.length);
    const websiteInputs = useRef(new Map<number, HTMLInputElement>());
    const [focusWebsite, setFocusWebsite] = useState<number | null>(null);
    const nameError = touched.name ? errors.firstName : undefined;

    useEffect(() => {
        if (focusWebsite === null) return;
        websiteInputs.current.get(focusWebsite)?.focus();
        setFocusWebsite(null);
    }, [focusWebsite]);

    const field = (key: string, label: string, options: FieldOptions = {}) => {
        const fieldId = `${id}-${key}`;
        const isName = key === 'firstName' || key === 'lastName';
        const error = isName ? nameError : touched[key] ? errors[key] : undefined;
        const props = {
            id: fieldId,
            value: String(draft[key] ?? ''),
            autoComplete: options.autoComplete,
            placeholder: label,
            onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onChange(key, event.target.value),
            onBlur: () => { if (!isName) setTouched(current => ({ ...current, [key]: true })); },
            'aria-invalid': !!error,
            'aria-describedby': [
                isName ? `${id}-requirements` : '',
                error ? (isName ? `${id}-name-error` : `${fieldId}-error`) : '',
                options.hint ? `${fieldId}-hint` : '',
            ].filter(Boolean).join(' ') || undefined,
        };
        return <div className="ui-field" key={key}>
            <label className="ui-sr-only" htmlFor={fieldId}>{label}</label>
            {options.rows
                ? <textarea {...props} className="ui-textarea qr-contact-textarea" rows={options.rows} />
                : <input {...props} className="ui-input" type={options.type ?? 'text'} />}
            {options.hint && <p className="ui-hint" id={`${fieldId}-hint`}>{options.hint}</p>}
            {error && !isName && <p className="qr-field-error" id={`${fieldId}-error`} role="alert">{error}</p>}
        </div>;
    };

    const addWebsite = () => {
        const newId = nextWebsiteId.current++;
        setWebsiteIds(current => [...current, newId]);
        onChange('websites', [...websites, '']);
        setFocusWebsite(newId);
    };

    const removeWebsite = (index: number) => {
        const remainingIds = websiteIds.filter((_, row) => row !== index);
        setWebsiteIds(remainingIds);
        onChange('websites', websites.filter((_, row) => row !== index));
        setFocusWebsite(remainingIds[Math.min(index, remainingIds.length - 1)]);
    };

    return <section className="qr-contact-fields qr-content-wide ui-stack" aria-labelledby={`${id}-title`}>
        <header className="qr-contact-heading">
            <h3 id={`${id}-title`}>Contact details</h3>
            <p className="ui-hint" id={`${id}-requirements`}>Add a first or last name. Everything else is optional.</p>
        </header>
        <div className="qr-contact-name" role="group" aria-label="Name" onBlur={event => {
            if (!event.currentTarget.contains(event.relatedTarget)) setTouched(current => ({ ...current, name: true }));
        }}>
            {field('firstName', 'First name', { autoComplete: 'given-name' })}
            {field('lastName', 'Last name', { autoComplete: 'family-name' })}
            {nameError && <p className="qr-field-error qr-content-wide" id={`${id}-name-error`} role="alert">{nameError}</p>}
        </div>
        {field('phone', 'Phone number', { type: 'tel', autoComplete: 'tel' })}
        {field('email', 'Email address', { type: 'email', autoComplete: 'email' })}
        <details className="qr-contact-more">
            <summary className="qr-contact-toggle">
                <span><span className="qr-style-label">More details</span><span className="ui-hint">Work, websites, address, and notes</span></span>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
            </summary>
            <div className="qr-contact-extra ui-stack">
                <fieldset className="qr-contact-work">
                    <legend className="ui-sr-only">Work</legend>
                    <div className="qr-contact-work-fields">
                        {field('company', 'Company', { autoComplete: 'organization' })}
                        {field('jobTitle', 'Job title', { autoComplete: 'organization-title' })}
                    </div>
                </fieldset>
                <fieldset className="qr-contact-websites">
                    <legend className="ui-sr-only">Websites</legend>
                    <div className="ui-stack" data-gap="sm">
                        {websites.map((url, index) => {
                            const rowId = websiteIds[index];
                            const fieldId = `${id}-website-${rowId}`;
                            const error = touched[`website-${rowId}`] ? errors[`websites.${index}`] : undefined;
                            return <div className="ui-field" key={rowId}>
                                <label className="ui-sr-only" htmlFor={fieldId}>Website {index + 1}</label>
                                <div className="qr-contact-website-row">
                                    <input className="ui-input" id={fieldId} type="url" autoComplete="url" autoCapitalize="none" spellCheck={false}
                                        placeholder="Website" value={url}
                                        ref={input => { if (input) websiteInputs.current.set(rowId, input); else websiteInputs.current.delete(rowId); }}
                                        onChange={event => onChange('websites', websites.map((value, row) => row === index ? event.target.value : value))}
                                        onBlur={() => setTouched(current => ({ ...current, [`website-${rowId}`]: true }))}
                                        aria-invalid={!!error} aria-describedby={error ? `${fieldId}-error` : undefined} />
                                    {websites.length > 1 && <button className="ui-button ui-icon-button" data-variant="ghost" type="button"
                                        aria-label={`Remove website ${index + 1}`} onClick={() => removeWebsite(index)}>
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
                                    </button>}
                                </div>
                                {error && <p className="qr-field-error" id={`${fieldId}-error`} role="alert">{error}</p>}
                            </div>;
                        })}
                    </div>
                    <button className="ui-button qr-contact-add-website" data-variant="secondary" type="button" onClick={addWebsite}>
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M8 3v10M3 8h10" /></svg>
                        Add website
                    </button>
                </fieldset>
                {field('address', 'Address', { autoComplete: 'street-address', rows: 2 })}
                {field('notes', 'Notes', { rows: 3 })}
            </div>
        </details>
    </section>;
}
