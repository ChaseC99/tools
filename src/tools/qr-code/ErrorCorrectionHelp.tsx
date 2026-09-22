import { useEffect, useRef, useState } from "react";

export default function ErrorCorrectionHelp() {
    const [open, setOpen] = useState(false);
    const pinned = useRef(false);
    const container = useRef<HTMLSpanElement>(null);
    const close = () => { pinned.current = false; setOpen(false); };

    useEffect(() => {
        if (!open) return;
        const dismiss = (event: PointerEvent) => {
            if (!container.current?.contains(event.target as Node)) close();
        };
        document.addEventListener("pointerdown", dismiss);
        return () => document.removeEventListener("pointerdown", dismiss);
    }, [open]);

    return (
        <span
            className="qr-help"
            ref={container}
            onMouseEnter={() => setOpen(true)}
            onMouseLeave={() => { if (!pinned.current) setOpen(false); }}
            onFocus={() => setOpen(true)}
            onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close(); }}
            onKeyDown={(event) => { if (event.key === "Escape") { close(); event.stopPropagation(); } }}
        >
            <button
                type="button"
                className="qr-info-button"
                aria-label="About error correction"
                aria-expanded={open}
                aria-controls="qr-error-correction-help"
                aria-describedby={open ? "qr-error-correction-help" : undefined}
                onClick={() => { pinned.current = !pinned.current; setOpen(pinned.current); }}
            >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v6" />
                    <circle cx="12" cy="7.5" r=".9" fill="currentColor" stroke="none" />
                </svg>
            </button>
            <span id="qr-error-correction-help" className="qr-help-popover" role="tooltip" hidden={!open}>
                Error correction helps a code stay readable when part is damaged or covered.<br /><br />
                Higher levels are more scannable but have less room for content.<br /><br />
                Medium works well for everyday use. High is selected automatically when you add a logo.
            </span>
        </span>
    );
}
