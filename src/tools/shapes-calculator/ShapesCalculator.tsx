import { useMemo, useState } from "react";
import { SHAPE_DEFINITIONS, calculateShape } from "./calculateShape.mjs";
import "./ShapesCalculator.css";

type ShapeId = keyof typeof SHAPE_DEFINITIONS;

const SHAPE_OPTIONS = Object.entries(SHAPE_DEFINITIONS).map(([id, definition]) => ({
  id: id as ShapeId,
  label: definition.label,
}));

const formatArea = (value: number) =>
  value.toLocaleString("en-US", {
    maximumFractionDigits: 6,
  });

const sanitizeNumberInput = (value: string) => {
  const trimmed = value.replace(/,/g, "");
  const cleaned = trimmed.replace(/[^\d.]/g, "");
  const firstDot = cleaned.indexOf(".");

  if (firstDot === -1) {
    return cleaned;
  }

  return `${cleaned.slice(0, firstDot + 1)}${cleaned.slice(firstDot + 1).replace(/\./g, "")}`;
};

const formatDimension = (value?: string) => {
  if (!value || value.trim() === "") {
    return "?";
  }

  return value;
};

function ShapePreview({ shapeId, fieldValues }: { shapeId: ShapeId; fieldValues: Record<string, string> }) {
  const dimension = (fieldKey: string) => formatDimension(fieldValues[fieldKey]);

  switch (shapeId) {
    case "square":
      return (
        <svg viewBox="0 0 320 220" className="shapes-calc__svg" aria-label="Square preview">
          <rect x="70" y="30" width="140" height="140" className="shapes-calc__shape-fill" />
          <line x1="70" y1="185" x2="210" y2="185" className="shapes-calc__measure-line" />
          <text x="140" y="204" className="shapes-calc__measure-text">
            side: {dimension("side")}
          </text>
        </svg>
      );
    case "rectangle":
      return (
        <svg viewBox="0 0 320 220" className="shapes-calc__svg" aria-label="Rectangle preview">
          <rect x="50" y="46" width="220" height="108" className="shapes-calc__shape-fill" />
          <line x1="50" y1="175" x2="270" y2="175" className="shapes-calc__measure-line" />
          <line x1="286" y1="46" x2="286" y2="154" className="shapes-calc__measure-line" />
          <text x="147" y="194" className="shapes-calc__measure-text">
            width: {dimension("width")}
          </text>
          <text x="292" y="102" className="shapes-calc__measure-text" textAnchor="start">
            height: {dimension("height")}
          </text>
        </svg>
      );
    case "triangle":
      return (
        <svg viewBox="0 0 320 220" className="shapes-calc__svg" aria-label="Triangle preview">
          <polygon points="70,168 260,168 160,40" className="shapes-calc__shape-fill" />
          <line x1="70" y1="186" x2="260" y2="186" className="shapes-calc__measure-line" />
          <line x1="160" y1="40" x2="160" y2="168" className="shapes-calc__measure-line shapes-calc__measure-line--dashed" />
          <text x="146" y="205" className="shapes-calc__measure-text">
            base: {dimension("base")}
          </text>
          <text x="168" y="105" className="shapes-calc__measure-text">
            height: {dimension("height")}
          </text>
        </svg>
      );
    case "circle":
      return (
        <svg viewBox="0 0 320 220" className="shapes-calc__svg" aria-label="Circle preview">
          <circle cx="160" cy="106" r="64" className="shapes-calc__shape-fill" />
          <line x1="160" y1="106" x2="224" y2="106" className="shapes-calc__measure-line" />
          <text x="170" y="96" className="shapes-calc__measure-text">
            radius: {dimension("radius")}
          </text>
        </svg>
      );
    case "parallelogram":
      return (
        <svg viewBox="0 0 320 220" className="shapes-calc__svg" aria-label="Parallelogram preview">
          <polygon points="90,48 260,48 220,162 50,162" className="shapes-calc__shape-fill" />
          <line x1="50" y1="180" x2="220" y2="180" className="shapes-calc__measure-line" />
          <line x1="50" y1="162" x2="50" y2="48" className="shapes-calc__measure-line shapes-calc__measure-line--dashed" />
          <text x="118" y="198" className="shapes-calc__measure-text">
            base: {dimension("base")}
          </text>
          <text x="56" y="108" className="shapes-calc__measure-text" textAnchor="start">
            height: {dimension("height")}
          </text>
        </svg>
      );
    case "trapezoid":
      return (
        <svg viewBox="0 0 320 220" className="shapes-calc__svg" aria-label="Trapezoid preview">
          <polygon points="102,52 222,52 260,162 64,162" className="shapes-calc__shape-fill" />
          <line x1="102" y1="34" x2="222" y2="34" className="shapes-calc__measure-line" />
          <line x1="64" y1="180" x2="260" y2="180" className="shapes-calc__measure-line" />
          <line x1="278" y1="52" x2="278" y2="162" className="shapes-calc__measure-line shapes-calc__measure-line--dashed" />
          <text x="140" y="28" className="shapes-calc__measure-text">
            base a: {dimension("baseA")}
          </text>
          <text x="132" y="198" className="shapes-calc__measure-text">
            base b: {dimension("baseB")}
          </text>
          <text x="284" y="108" className="shapes-calc__measure-text" textAnchor="start">
            height: {dimension("height")}
          </text>
        </svg>
      );
    default:
      return null;
  }
}

export default function ShapesCalculator() {
  const [shapeId, setShapeId] = useState<ShapeId>("square");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({
    side: "",
  });

  const shapeDefinition = SHAPE_DEFINITIONS[shapeId];

  const calculation = useMemo(
    () => calculateShape(shapeId, fieldValues),
    [shapeId, fieldValues],
  );

  const handleShapeChange = (nextShapeId: ShapeId) => {
    const nextShape = SHAPE_DEFINITIONS[nextShapeId];
    const nextValues: Record<string, string> = {};

    nextShape.fields.forEach((field) => {
      nextValues[field.key] = "";
    });

    setShapeId(nextShapeId);
    setFieldValues(nextValues);
  };

  const updateField = (fieldKey: string, value: string) => {
    setFieldValues((current) => ({
      ...current,
      [fieldKey]: sanitizeNumberInput(value),
    }));
  };

  return (
    <div className="shapes-calc ui-stack">
      <label className="ui-field">
        <span className="ui-label">Shape</span>
        <select
          value={shapeId}
          onChange={(event) => handleShapeChange(event.target.value as ShapeId)}
          className="ui-select"
        >
          {SHAPE_OPTIONS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="ui-grid">
        {shapeDefinition.fields.map((field) => (
          <label className="ui-field" key={field.key}>
            <span className="ui-label">{field.label}</span>
            <input
              type="text"
              inputMode="decimal"
              value={fieldValues[field.key] ?? ""}
              onChange={(event) => updateField(field.key, event.target.value)}
              placeholder="0"
              className="ui-input"
            />
          </label>
        ))}
      </div>

      <div className="shapes-calc__panes">
        <div className="shapes-calc__preview-card ui-panel" data-variant="inset">
          <ShapePreview shapeId={shapeId} fieldValues={fieldValues} />
        </div>

        {!calculation.ok ? (
          <p className="ui-empty-state">{calculation.error}</p>
        ) : (
          <div className="shapes-calc__result-card ui-result-card ui-stack">
            <p className="shapes-calc__result-label">{calculation.shapeLabel} Area</p>
            <p className="shapes-calc__result-value">
              {formatArea(calculation.area)}
              <span className="shapes-calc__unit"> square units</span>
            </p>
            <div className="shapes-calc__formula">
              <p className="shapes-calc__formula-title">Formula</p>
              <p className="shapes-calc__formula-text">{calculation.formula}</p>
              <p className="shapes-calc__formula-text">{calculation.substitutedFormula}</p>
              <p className="shapes-calc__formula-text">A = {formatArea(calculation.area)}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
