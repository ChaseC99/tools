import { useState } from "react";
import { calculateContrast, normalizeHex } from "./contrast.mjs";
import "./ContrastChecker.css";

function ColorField({ id, label, value, onChange }: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    const normalized = normalizeHex(value);
    return (
        <div className="ui-field">
            <label className="ui-label" htmlFor={id}>{label}</label>
            <div className="contrast-checker__color-controls">
                <input type="color" className="contrast-checker__picker"
                    aria-label={`Pick ${label.toLowerCase()}`}
                    value={normalized ?? "#000000"}
                    onChange={(event) => onChange(event.target.value.toUpperCase())} />
                <input id={id} type="text" className="ui-input contrast-checker__hex"
                    value={value} placeholder="Hex" spellCheck={false} autoComplete="off"
                    aria-invalid={!normalized} aria-describedby={normalized ? undefined : `${id}-hint`}
                    onChange={(event) => onChange(event.target.value)}
                    onBlur={() => { if (normalized) onChange(normalized); }} />
            </div>
            <p id={`${id}-hint`} className="ui-hint contrast-checker__error" style={{ visibility: normalized ? "hidden" : "visible" }} aria-hidden={!!normalized}>
                Enter a valid hex color, such as #123 or #123456.
            </p>
        </div>
    );
}

export default function ContrastChecker() {
    const [foreground, setForeground] = useState("#1D1D1B");
    const [background, setBackground] = useState("#FFFFFF");
    const calculation = calculateContrast(foreground, background);
    // Keep the result panels in the layout while incomplete input is being edited.
    const result = calculation ?? calculateContrast("#1D1D1B", "#FFFFFF");

    return (
        <section className="contrast-checker ui-stack" aria-label="Color contrast checker">
            <div className="ui-panel contrast-checker__controls">
                <ColorField id="contrast-foreground" label="Text color" value={foreground} onChange={setForeground} />
                <button type="button" className="ui-button" data-variant="secondary"
                    onClick={() => { setForeground(background); setBackground(foreground); }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />
                    </svg>
                    Swap colors
                </button>
                <ColorField id="contrast-background" label="Background color" value={background} onChange={setBackground} />
            </div>

            <div className="contrast-checker__results" data-invalid={!calculation} aria-live="polite" aria-atomic="true">
                    <div className="ui-panel ui-stack" aria-hidden={!calculation}>
                        <div>
                            <h2 className="ui-section-label">Contrast ratio</h2>
                            <p className="contrast-checker__ratio">{result.ratio.toFixed(2)}<span>:1</span></p>
                        </div>
                        <dl className="contrast-checker__checks">
                            {result.checks.map((check) => (
                                <div key={check.label}>
                                    <dt>{check.label}<span className="ui-hint">{check.hint ?? `At least ${check.minimum}:1`}</span></dt>
                                    <dd><span className="ui-badge" data-variant={check.passes ? "success" : "danger"}>
                                        {check.passes ? "Pass" : "Fail"}
                                    </span></dd>
                                </div>
                            ))}
                        </dl>
                    </div>
                    <div className="ui-panel ui-stack" aria-hidden={!calculation}>
                        <h2 className="ui-section-label">Live preview</h2>
                        <p className="ui-hint">Your colors on normal text, large text, and UI elements. AA and AAA grade the same text samples at different contrast thresholds.</p>
                        <div className="contrast-checker__preview" style={{
                            color: normalizeHex(foreground), backgroundColor: normalizeHex(background),
                        }}>
                            <p className="contrast-checker__large">Large text</p>
                            <p className="contrast-checker__normal">Normal text. A clear contrast between text and its background makes reading easier.</p>
                            <div className="contrast-checker__ui-sample" role="img" aria-label="UI contrast sample: outlined square and checkmark">
                                <span className="contrast-checker__sample-box">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="m5 12 4 4L19 6" />
                                    </svg>
                                </span>
                                <span className="contrast-checker__normal">UI components &amp; graphics</span>
                            </div>
                        </div>
                    </div>
                {!calculation && <p className="ui-empty-state">Enter two valid hex colors to see the contrast ratio and preview.</p>}
            </div>

            <p className="ui-hint">
                Checks opaque sRGB colors against WCAG 2.2 contrast requirements for{" "}
                <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">AA text</a>,{" "}
                <a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html">AAA text</a>, and{" "}
                <a href="https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html">UI components and graphics</a>.
                {" "}These results assess this color pair only; UI and graphic checks apply to required visual information against adjacent colors.
                {" "}The QR recommendation treats the text color as the code color. It is a design guideline, not a scan guarantee; test your finished QR code.
            </p>
        </section>
    );
}
