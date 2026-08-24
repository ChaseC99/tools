import type { CSSProperties } from "react";

export type ErrorMessageProps = {
    message: string | null;
    theme?: "light" | "dark";
    style?: CSSProperties;
};

export default function ErrorMessage({ message, theme, style }: ErrorMessageProps) {
    if (!message) return null;

    return (
        <p
            className="ui-alert"
            data-variant="danger"
            data-theme={theme}
            role="alert"
            style={style}
        >
            {message}
        </p>
    );
}
