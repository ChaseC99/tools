import { useState } from "react";

export default function CaseConverter() {
    const [text, setText] = useState("");
    const [copied, setCopied] = useState(false);

    const copy = () => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        });
    };

    return (
        <div style={styles.container}>
            <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Type or paste text here..."
                style={styles.textarea}
                spellCheck={false}
            />
            <div style={styles.buttons}>
                <div style={styles.buttonGroup}>
                    <button style={styles.btn} onClick={() => setText(text.toUpperCase())}>
                        UPPERCASE
                    </button>
                    <button style={styles.btn} onClick={() => setText(text.toLowerCase())}>
                        lowercase
                    </button>
                </div>
                <button style={styles.copyBtn} onClick={copy} disabled={!text}>
                    <img src="/icons/copy.svg" alt="Copy" />
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
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
        resize: "vertical",
        boxSizing: "border-box",
    },
    buttonGroup: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
    },
    buttons: {
        display: "flex",
        gap: "8px",
        justifyContent: "space-between",
    },
    btn: {
        padding: "8px 20px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        background: "#fff",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold",
    },
    copyBtn: {
        padding: "8px 20px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        background: "#fff",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: "bold",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
};
