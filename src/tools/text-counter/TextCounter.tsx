import { useState } from "react";

export default function TextCounter() {
    const [text, setText] = useState("");

    const charCount = text.length;
    const wordCount = text.trim() === "" ? 0 : text.trim().split(/\s+/).filter(Boolean).length;
    const lineCount = text === "" ? 0 : text.split("\n").length;

    const stats = [
        { label: "Words", value: wordCount },
        { label: "Characters", value: charCount },
        { label: "Lines", value: lineCount },
    ];

    const textareaRef = (el: HTMLTextAreaElement | null) => {
        if (el) {
            el.style.height = "auto";
            el.style.height = Math.max(250, el.scrollHeight) + "px";
        }
    };

    return (
        <div style={styles.container}>
            <div style={styles.statsRow}>
                {stats.map((stat) => (
                    <div key={stat.label} style={styles.statCard}>
                        <div style={styles.statValue}>{stat.value}</div>
                        <div style={styles.statLabel}>{stat.label}</div>
                    </div>
                ))}
            </div>
            <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste text here..."
                style={styles.textarea}
                spellCheck={false}
            />
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: "24px 20px",
        maxWidth: "700px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    textarea: {
        width: "100%",
        minHeight: "250px",
        padding: "12px",
        fontFamily: "monospace",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        resize: "none",
        overflow: "hidden",
        boxSizing: "border-box",
    },
    statsRow: {
        display: "flex",
        gap: "12px",
    },
    statCard: {
        flex: 1,
        padding: "16px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        textAlign: "center",
    },
    statValue: {
        fontSize: "28px",
        fontWeight: "bold",
    },
    statLabel: {
        fontSize: "13px",
        color: "#666",
        marginTop: "4px",
    },
};
