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
        <section className="ui-stack" aria-label="Case converter">
            <label className="ui-field">
                <span className="ui-label">Text</span>
                <textarea
                    className="ui-textarea ui-code-input"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Type or paste text here…"
                    spellCheck={false}
                />
            </label>
            <div className="ui-action-bar ui-action-bar--split">
                <div className="ui-inline">
                    <button className="ui-button" data-variant="secondary" onClick={() => setText(text.toUpperCase())}>
                        UPPERCASE
                    </button>
                    <button className="ui-button" data-variant="secondary" onClick={() => setText(text.toLowerCase())}>
                        lowercase
                    </button>
                </div>
                <button className="ui-button" onClick={copy} disabled={!text}>
                    <img className="ui-button-icon" src="/icons/copy.svg" alt="" aria-hidden="true" />
                    {copied ? "Copied!" : "Copy"}
                </button>
            </div>
            <span className="ui-sr-only" role="status" aria-live="polite">{copied ? "Text copied" : ""}</span>
        </section>
    );
}
