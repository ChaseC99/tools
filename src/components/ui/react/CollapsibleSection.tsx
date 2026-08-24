import { useId, useState, type CSSProperties, type ReactNode } from "react";

export type CollapsibleSectionProps = {
    label: string;
    defaultOpen?: boolean;
    children: ReactNode;
    style?: CSSProperties;
};

export default function CollapsibleSection({
    label,
    defaultOpen = false,
    children,
    style,
}: CollapsibleSectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    const contentId = useId();

    return (
        <section className="ui-disclosure" style={style}>
            <button
                type="button"
                className="ui-disclosure-toggle"
                aria-expanded={open}
                aria-controls={contentId}
                onClick={() => setOpen((current) => !current)}
            >
                <span className="ui-section-label">{label}</span>
                <span className="ui-disclosure-icon" aria-hidden="true">⌄</span>
            </button>
            <div id={contentId} className="ui-disclosure-content" hidden={!open}>
                {children}
            </div>
        </section>
    );
}
