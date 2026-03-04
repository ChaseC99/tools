import { useState, type CSSProperties, type ReactNode } from "react";

type CollapsibleSectionProps = {
    label: string;
    defaultOpen?: boolean;
    children: ReactNode;
    style?: CSSProperties;
};

const SECTION_STYLE: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
};

const TOGGLE_STYLE: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: "pointer",
    userSelect: "none",
    padding: "6px 0",
};

const LABEL_STYLE: CSSProperties = {
    color: "#999",
    fontSize: "0.8rem",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
};

export default function CollapsibleSection({
    label,
    defaultOpen = false,
    children,
    style,
}: CollapsibleSectionProps) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div style={{ ...SECTION_STYLE, ...style }}>
            <div style={TOGGLE_STYLE} onClick={() => setOpen(!open)}>
                <span style={LABEL_STYLE}>{label}</span>
                <span style={{ color: "#666", fontSize: "0.75rem", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
                    ▼
                </span>
            </div>
            {open && children}
        </div>
    );
}
