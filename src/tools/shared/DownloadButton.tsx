import type { CSSProperties } from "react";

type DownloadButtonProps = {
    href?: string | null;
    filename: string;
    onClick?: () => void;
    disabled?: boolean;
    label?: string;
    theme?: "light" | "dark";
    style?: CSSProperties;
};

const DownloadIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        height="20px"
        viewBox="0 -960 960 960"
        width="20px"
        fill="currentColor"
    >
        <path d="M480-320 280-520l56-58 104 104v-326h80v326l104-104 56 58-200 200ZM240-160q-33 0-56.5-23.5T160-240v-120h80v120h480v-120h80v120q0 33-23.5 56.5T720-160H240Z" />
    </svg>
);

export default function DownloadButton({
    href,
    filename,
    onClick,
    disabled = false,
    label = "Download",
    theme = "light",
    style,
}: DownloadButtonProps) {
    const isDisabled = disabled || (!href && !onClick);

    const lightStyle: CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.55rem 1rem",
        borderRadius: "8px",
        border: "1px solid #16a34a",
        background: isDisabled ? "#86efac" : "#22c55e",
        color: "#fff",
        cursor: isDisabled ? "not-allowed" : "pointer",
        textDecoration: "none",
        fontSize: "0.95rem",
    };

    const darkStyle: CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: "0.4rem",
        padding: "0.5rem 1.5rem",
        backgroundColor: isDisabled ? "#6b9fd4" : "#4a90d9",
        color: "#fff",
        borderRadius: 6,
        border: "none",
        cursor: isDisabled ? "not-allowed" : "pointer",
        textDecoration: "none",
        fontSize: "0.95rem",
    };

    const baseStyle = theme === "dark" ? darkStyle : lightStyle;
    const mergedStyle = { ...baseStyle, ...style };

    if (href && !isDisabled) {
        return (
            <a href={href} download={filename} style={mergedStyle}>
                <DownloadIcon />
                {label}
            </a>
        );
    }

    return (
        <button type="button" onClick={onClick} disabled={isDisabled} style={mergedStyle}>
            <DownloadIcon />
            {label}
        </button>
    );
}
