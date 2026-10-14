import type { ReactNode } from "react";

/** Keep the current choice visible even when its picker is closed. */
export default function StyleSection({ label, value, preview, children }: {
    label: string;
    value: string;
    preview?: ReactNode;
    children: ReactNode;
}) {
    return <details className="qr-style-section">
        <summary className="qr-style-toggle">
            <span className="qr-style-label">{label}</span>
            <span className="qr-style-current">
                {preview && <span className="qr-style-sample" aria-hidden="true">{preview}</span>}
                {value && <span className="qr-style-value" title={value}>{value}</span>}
            </span>
            <svg className="qr-style-chevron" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
        </summary>
        <div className="qr-style-options">{children}</div>
    </details>;
}
