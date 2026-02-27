import type { CSSProperties } from "react";

type ErrorMessageProps = {
    message: string | null;
    theme?: "light" | "dark";
    style?: CSSProperties;
};

export default function ErrorMessage({ message, theme = "light", style }: ErrorMessageProps) {
    if (!message) return null;

    const baseStyle: CSSProperties =
        theme === "dark"
            ? { margin: 0, color: "#e55" }
            : {
                  margin: 0,
                  color: "#b91c1c",
                  background: "#fee2e2",
                  padding: "0.5rem 0.75rem",
                  borderRadius: "8px",
              };

    return <p style={{ ...baseStyle, ...style }}>{message}</p>;
}
