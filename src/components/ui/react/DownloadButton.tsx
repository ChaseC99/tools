import type { CSSProperties } from "react";

export type DownloadButtonProps = {
    href?: string | null;
    filename: string;
    onClick?: () => void;
    disabled?: boolean;
    label?: string;
    theme?: "light" | "dark";
    style?: CSSProperties;
    className?: string;
};

const DownloadIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        height="20"
        viewBox="0 -960 960 960"
        width="20"
        fill="currentColor"
        aria-hidden="true"
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
    theme,
    style,
    className = "",
}: DownloadButtonProps) {
    const isDisabled = disabled || (!href && !onClick);
    const classes = ["ui-button", className].filter(Boolean).join(" ");

    if (href && !isDisabled) {
        return (
            <a
                href={href}
                download={filename}
                className={classes}
                data-theme={theme}
                style={style}
            >
                <DownloadIcon />
                {label}
            </a>
        );
    }

    return (
        <button
            type="button"
            onClick={onClick}
            disabled={isDisabled}
            className={classes}
            data-theme={theme}
            style={style}
        >
            <DownloadIcon />
            {label}
        </button>
    );
}
