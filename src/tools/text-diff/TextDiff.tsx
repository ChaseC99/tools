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
        <section className="ui-stack" data-gap="lg" aria-label="Text comparison">
            <div className="ui-grid ui-grid--two">
                <label className="ui-field">
                    <span className="ui-label">Original</span>
                    <textarea
                        className="ui-textarea ui-code-input"
                        value={original}
                        onChange={(e) => setOriginal(e.target.value)}
                        placeholder="Paste original text…"
                        spellCheck={false}
                    />
                </label>
                <label className="ui-field">
                    <span className="ui-label">Modified</span>
                    <textarea
                        className="ui-textarea ui-code-input"
                        value={modified}
                        onChange={(e) => setModified(e.target.value)}
                        placeholder="Paste modified text…"
                        spellCheck={false}
                    />
                </label>
            </div>

            {hasDiff && (
                <>
                    <div className="ui-segmented ui-self-center" role="group" aria-label="Diff view">
                        <button
                            className="ui-button"
                            onClick={() => setView("inline")}
                            aria-pressed={view === "inline"}
                        >
                            Inline
                        </button>
                        <button
                            className="ui-button"
                            onClick={() => setView("side-by-side")}
                            aria-pressed={view === "side-by-side"}
                        >
                            Side by Side
                        </button>
                    </div>

                    {view === "inline" ? (
                        <pre className="ui-code-panel" aria-label="Inline differences">
                            {charDiff.map((part, i) => (
                                <span
                                    key={i}
                                    className={part.added ? "ui-diff-added" : part.removed ? "ui-diff-removed" : undefined}
                                >
                                    {part.value}
                                </span>
                            ))}
                        </pre>
                    ) : (
                        <div className="ui-grid ui-grid--two">
                            <pre className="ui-code-panel" aria-label="Original differences">
                                {lineDiff.map((part, i) =>
                                    !part.added ? (
                                        <span key={i} className={part.removed ? "ui-diff-removed" : undefined}>
                                            {part.value}
                                        </span>
                                    ) : null
                                )}
                            </pre>
                            <pre className="ui-code-panel" aria-label="Modified differences">
                                {lineDiff.map((part, i) =>
                                    !part.removed ? (
                                        <span key={i} className={part.added ? "ui-diff-added" : undefined}>
                                            {part.value}
                                        </span>
                                    ) : null
                                )}
                            </pre>
                        </div>
                    )}
                </>
            )}
            {!hasDiff && <div className="ui-empty-state">Enter text in either field to see the differences.</div>}
        </section>
    );
}
