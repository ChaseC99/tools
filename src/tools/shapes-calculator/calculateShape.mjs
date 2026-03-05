export const SHAPE_DEFINITIONS = {
  square: {
    label: "Square",
    fields: [{ key: "side", label: "Side" }],
    calculate: ({ side }) => {
      const area = side ** 2;
      return {
        area,
        formula: "A = s²",
        substitutedFormula: `A = ${side}²`,
      };
    },
  },
  rectangle: {
    label: "Rectangle",
    fields: [
      { key: "width", label: "Width" },
      { key: "height", label: "Height" },
    ],
    calculate: ({ width, height }) => {
      const area = width * height;
      return {
        area,
        formula: "A = w × h",
        substitutedFormula: `A = ${width} × ${height}`,
      };
    },
  },
  triangle: {
    label: "Triangle",
    fields: [
      { key: "base", label: "Base" },
      { key: "height", label: "Height" },
    ],
    calculate: ({ base, height }) => {
      const area = (base * height) / 2;
      return {
        area,
        formula: "A = (b × h) / 2",
        substitutedFormula: `A = (${base} × ${height}) / 2`,
      };
    },
  },
  circle: {
    label: "Circle",
    fields: [{ key: "radius", label: "Radius" }],
    calculate: ({ radius }) => {
      const area = Math.PI * radius ** 2;
      return {
        area,
        formula: "A = πr²",
        substitutedFormula: `A = π × ${radius}²`,
      };
    },
  },
  parallelogram: {
    label: "Parallelogram",
    fields: [
      { key: "base", label: "Base" },
      { key: "height", label: "Height" },
    ],
    calculate: ({ base, height }) => {
      const area = base * height;
      return {
        area,
        formula: "A = b × h",
        substitutedFormula: `A = ${base} × ${height}`,
      };
    },
  },
  trapezoid: {
    label: "Trapezoid",
    fields: [
      { key: "baseA", label: "Base A" },
      { key: "baseB", label: "Base B" },
      { key: "height", label: "Height" },
    ],
    calculate: ({ baseA, baseB, height }) => {
      const area = ((baseA + baseB) * height) / 2;
      return {
        area,
        formula: "A = ((a + b) × h) / 2",
        substitutedFormula: `A = ((${baseA} + ${baseB}) × ${height}) / 2`,
      };
    },
  },
};

const isFiniteNumber = (value) => Number.isFinite(value);

export function calculateShape(shapeId, values) {
  const shape = SHAPE_DEFINITIONS[shapeId];
  if (!shape) {
    return { ok: false, error: "Please choose a valid shape." };
  }

  const parsedValues = {};

  for (const field of shape.fields) {
    const rawValue = values[field.key];
    if (rawValue === undefined || String(rawValue).trim() === "") {
      return { ok: false, error: `Enter a value for ${field.label.toLowerCase()}.` };
    }

    const parsed = Number(rawValue);
    if (!isFiniteNumber(parsed) || parsed <= 0) {
      return {
        ok: false,
        error: `${field.label} must be a number greater than 0.`,
      };
    }

    parsedValues[field.key] = parsed;
  }

  const result = shape.calculate(parsedValues);
  if (!isFiniteNumber(result.area)) {
    return {
      ok: false,
      error: "Unable to calculate area with the provided values.",
    };
  }

  return {
    ok: true,
    shapeLabel: shape.label,
    area: result.area,
    formula: result.formula,
    substitutedFormula: result.substitutedFormula,
  };
}
