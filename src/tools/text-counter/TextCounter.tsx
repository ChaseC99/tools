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
        <section className="ui-stack" aria-label="Text counter">
            <div className="ui-result-grid" aria-live="polite">
                {stats.map((stat) => (
                    <div key={stat.label} className="ui-stat-card">
                        <span className="ui-stat-value">{stat.value}</span>
                        <span className="ui-stat-label">{stat.label}</span>
                    </div>
                ))}
            </div>
            <label className="ui-field">
                <span className="ui-label">Text</span>
                <textarea
                    className="ui-textarea ui-code-input"
                    ref={textareaRef}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type or paste text here…"
                    spellCheck={false}
                />
            </label>
        </section>
    );
}
