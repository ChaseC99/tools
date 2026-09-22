import { useId } from "react";
import ShapeSample, { type ShapePart } from "./ShapeSample";

type ShapeOption<T extends string> = { value: T; label: string };

export default function ShapePicker<T extends string>({ label, part, options, value, onChange }: {
    label: string;
    part: ShapePart;
    options: ShapeOption<T>[];
    value: T;
    onChange: (value: T) => void;
}) {
    const name = useId();
    return (
        <fieldset className="qr-shape-picker">
            <legend className="ui-label">{label}</legend>
            <div className="qr-shape-choices" data-part={part}>
                {options.map((option) => (
                    <label key={option.value} className="qr-shape-option">
                        <input className="ui-sr-only" type="radio" name={name}
                            value={option.value} checked={value === option.value}
                            aria-label={`${option.label} ${label.toLowerCase()}`} onChange={() => onChange(option.value)} />
                        <span className="qr-shape-tile">
                            <ShapeSample part={part} value={option.value} />
                            <span className="qr-shape-name">{option.label}</span>
                            <svg className="qr-shape-check" viewBox="0 0 16 16" aria-hidden="true">
                                <path d="m3 8 3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" />
                            </svg>
                        </span>
                    </label>
                ))}
            </div>
        </fieldset>
    );
}
