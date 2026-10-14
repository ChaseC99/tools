import { useId, useState } from "react";

type Level = "L" | "M" | "Q" | "H";

export default function ErrorCorrectionSelect({ value, locked, onChange }: {
    value: Level;
    locked: boolean;
    onChange: (value: Level) => void;
}) {
    const hintId = useId();
    const [showHint, setShowHint] = useState(false);

    return <span className="qr-correction-select" data-locked={locked}
        tabIndex={locked ? 0 : undefined}
        role={locked ? "group" : undefined}
        aria-label={locked ? "Error correction: High" : undefined}
        aria-describedby={locked ? hintId : undefined}
        onMouseEnter={() => setShowHint(true)}
        onMouseLeave={event => { if (!event.currentTarget.matches(":focus-within")) setShowHint(false); }}
        onFocus={() => setShowHint(true)}
        onBlur={() => setShowHint(false)}
        onKeyDown={event => { if (event.key === "Escape") setShowHint(false); }}>
        <select id="qr-ec" className="ui-select" value={value}
            onChange={event => onChange(event.target.value as Level)} disabled={locked}
            aria-describedby={locked ? hintId : undefined}>
            <option value="L">Low</option>
            <option value="M">Medium</option>
            <option value="Q">Quartile</option>
            <option value="H">High</option>
        </select>
        {locked && <span id={hintId} className="qr-correction-tooltip" role="tooltip" hidden={!showHint}>
            Logo overlay requires high error correction.
        </span>}
    </span>;
}
