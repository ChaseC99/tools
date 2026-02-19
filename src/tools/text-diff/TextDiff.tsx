import { useState, useMemo } from "react";
import { diffChars, diffLines } from "diff";

type ViewMode = "inline" | "side-by-side";

export default function TextDiff() {
    const [original, setOriginal] = useState("");
    const [modified, setModified] = useState("");
    const [view, setView] = useState<ViewMode>("inline");

    const charDiff = useMemo(() => diffChars(original, modified), [original, modified]);
    const lineDiff = useMemo(() => diffLines(original, modified), [original, modified]);

    const hasDiff = original !== "" || modified !== "";

    return (
        <div style={styles.container}>
            <div style={styles.inputs}>
                <div style={styles.inputPanel}>
                    <label style={styles.label}>Original</label>
                    <textarea
                        value={original}
                        onChange={(e) => setOriginal(e.target.value)}
                        placeholder="Paste original text..."
                        style={styles.textarea}
                        spellCheck={false}
                    />
                </div>
                <div style={styles.inputPanel}>
                    <label style={styles.label}>Modified</label>
                    <textarea
                        value={modified}
                        onChange={(e) => setModified(e.target.value)}
                        placeholder="Paste modified text..."
                        style={styles.textarea}
                        spellCheck={false}
                    />
                </div>
            </div>

            {hasDiff && (
                <>
                    <div style={styles.toggleRow}>
                        <button
                            onClick={() => setView("inline")}
                            style={view === "inline" ? { ...styles.toggleBtn, ...styles.toggleActive } : styles.toggleBtn}
                        >
                            Inline
                        </button>
                        <button
                            onClick={() => setView("side-by-side")}
                            style={view === "side-by-side" ? { ...styles.toggleBtn, ...styles.toggleActive } : styles.toggleBtn}
                        >
                            Side by Side
                        </button>
                    </div>

                    {view === "inline" ? (
                        <pre style={styles.output}>
                            {charDiff.map((part, i) => (
                                <span
                                    key={i}
                                    style={{
                                        backgroundColor: part.added ? "#d4edda" : part.removed ? "#f8d7da" : "transparent",
                                        textDecoration: part.removed ? "line-through" : "none",
                                    }}
                                >
                                    {part.value}
                                </span>
                            ))}
                        </pre>
                    ) : (
                        <div style={styles.sideBySide}>
                            <pre style={styles.sidePanel}>
                                {lineDiff.map((part, i) =>
                                    !part.added ? (
                                        <span
                                            key={i}
                                            style={{ backgroundColor: part.removed ? "#f8d7da" : "transparent" }}
                                        >
                                            {part.value}
                                        </span>
                                    ) : null
                                )}
                            </pre>
                            <pre style={styles.sidePanel}>
                                {lineDiff.map((part, i) =>
                                    !part.removed ? (
                                        <span
                                            key={i}
                                            style={{ backgroundColor: part.added ? "#d4edda" : "transparent" }}
                                        >
                                            {part.value}
                                        </span>
                                    ) : null
                                )}
                            </pre>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        padding: "24px 20px",
        maxWidth: "1000px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
    },
    inputs: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
    },
    inputPanel: {
        display: "flex",
        flexDirection: "column",
        gap: "8px",
    },
    label: {
        fontWeight: "bold",
        fontSize: "14px",
    },
    textarea: {
        width: "100%",
        minHeight: "200px",
        padding: "12px",
        fontFamily: "monospace",
        fontSize: "13px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        resize: "vertical",
        boxSizing: "border-box",
    },
    toggleRow: {
        display: "flex",
        gap: "8px",
        justifyContent: "center",
    },
    toggleBtn: {
        padding: "6px 16px",
        border: "1px solid #ccc",
        borderRadius: "6px",
        background: "#fff",
        cursor: "pointer",
        fontSize: "13px",
    },
    toggleActive: {
        background: "#333",
        color: "#fff",
        borderColor: "#333",
    },
    output: {
        padding: "12px",
        fontFamily: "monospace",
        fontSize: "13px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        background: "#fafafa",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        margin: 0,
    },
    sideBySide: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "16px",
    },
    sidePanel: {
        padding: "12px",
        fontFamily: "monospace",
        fontSize: "13px",
        border: "1px solid #ccc",
        borderRadius: "8px",
        background: "#fafafa",
        overflow: "auto",
        whiteSpace: "pre-wrap",
        margin: 0,
    },
};
