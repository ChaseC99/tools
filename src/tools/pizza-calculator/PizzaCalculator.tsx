import { useMemo, useState } from "react";
import {
  APPETITE_LEVELS,
  CHAIN_PRESETS,
  SIZE_KEYS,
  SIZE_LABELS,
  calculatePizza,
} from "./calculatePizza.mjs";
import "./PizzaCalculator.css";

type SizeId = keyof typeof SIZE_LABELS;
type AppetiteId = keyof typeof APPETITE_LEVELS;
type ChainId = keyof typeof CHAIN_PRESETS;

const APPETITE_OPTIONS = Object.entries(APPETITE_LEVELS).map(([id, def]) => ({
  id: id as AppetiteId,
  label: `${def.label} (${def.adultSlices}/adult, ${def.childSlices}/child)`,
}));

const CHAIN_OPTIONS = Object.entries(CHAIN_PRESETS).map(([id, def]) => ({
  id: id as ChainId,
  label: def.label,
}));

const MAX_VISUAL_PIZZAS = 20;

function PizzaSvg({ slices }: { slices: number }) {
  const wedges = [];
  for (let i = 0; i < slices; i++) {
    const startAngle = (i * 360) / slices - 90;
    const endAngle = ((i + 1) * 360) / slices - 90;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    const r = 28;
    const cx = 32;
    const cy = 32;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    wedges.push(
      <path
        key={i}
        d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`}
        fill="#fbbf24"
        stroke="#d4a056"
        strokeWidth="1.5"
      />,
    );
  }
  return (
    <svg viewBox="0 0 64 64" className="pizza-calc__pizza-svg" aria-label="Pizza">
      <circle cx="32" cy="32" r="30" fill="#d4a056" />
      {wedges}
    </svg>
  );
}

function getSizeOptions(chainId: ChainId) {
  const preset = CHAIN_PRESETS[chainId];
  return SIZE_KEYS.map((id) => {
    const sizeInfo = preset.sizes[id];
    return {
      id: id as SizeId,
      label: `${(SIZE_LABELS as Record<string, string>)[id]} (${sizeInfo.diameter})`,
    };
  });
}

function getSlicesForSize(chainId: ChainId, sizeId: SizeId) {
  return CHAIN_PRESETS[chainId].sizes[sizeId].slices;
}

export default function PizzaCalculator() {
  const [adults, setAdults] = useState("4");
  const [children, setChildren] = useState("0");
  const [appetite, setAppetite] = useState<AppetiteId>("normal");
  const [size, setSize] = useState<SizeId>("large");
  const [chain, setChain] = useState<ChainId>("custom");
  const [slicesPerPizza, setSlicesPerPizza] = useState(
    () => String(getSlicesForSize("custom", "large")),
  );
  const [servingOtherFood, setServingOtherFood] = useState(false);

  const sizeOptions = useMemo(() => getSizeOptions(chain), [chain]);

  const result = useMemo(
    () => calculatePizza({ adults, children, appetite, slicesPerPizza, servingOtherFood }),
    [adults, children, appetite, slicesPerPizza, servingOtherFood],
  );

  const sanitize = (value: string) => value.replace(/[^\d]/g, "");

  const handleChainChange = (nextChain: ChainId) => {
    setChain(nextChain);
    setSlicesPerPizza(String(getSlicesForSize(nextChain, size)));
  };

  const handleSizeChange = (nextSize: SizeId) => {
    setSize(nextSize);
    setSlicesPerPizza(String(getSlicesForSize(chain, nextSize)));
  };

  const handleSlicesChange = (value: string) => {
    setSlicesPerPizza(sanitize(value));
    setChain("custom");
  };

  return (
    <div className="pizza-calc">
      <div className="pizza-calc__grid">
        <label className="pizza-calc__field">
          <span className="pizza-calc__label">Number of Adults</span>
          <input
            type="text"
            inputMode="numeric"
            value={adults}
            onChange={(e) => setAdults(sanitize(e.target.value))}
            placeholder="0"
            className="pizza-calc__input"
          />
        </label>

        <label className="pizza-calc__field">
          <span className="pizza-calc__label">Number of Children</span>
          <input
            type="text"
            inputMode="numeric"
            value={children}
            onChange={(e) => setChildren(sanitize(e.target.value))}
            placeholder="0"
            className="pizza-calc__input"
          />
        </label>

        <label className="pizza-calc__field">
          <span className="pizza-calc__label">Appetite Level</span>
          <select
            value={appetite}
            onChange={(e) => setAppetite(e.target.value as AppetiteId)}
            className="pizza-calc__select"
          >
            {APPETITE_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pizza-calc__field">
          <span className="pizza-calc__label">Pizza Chain</span>
          <select
            value={chain}
            onChange={(e) => handleChainChange(e.target.value as ChainId)}
            className="pizza-calc__select"
          >
            {CHAIN_OPTIONS.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pizza-calc__field">
          <span className="pizza-calc__label">Pizza Size</span>
          <select
            value={size}
            onChange={(e) => handleSizeChange(e.target.value as SizeId)}
            className="pizza-calc__select"
          >
            {sizeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pizza-calc__field">
          <span className="pizza-calc__label">Slices per Pizza</span>
          <input
            type="text"
            inputMode="numeric"
            value={slicesPerPizza}
            onChange={(e) => handleSlicesChange(e.target.value)}
            placeholder="8"
            className="pizza-calc__input"
          />
        </label>

        <div className="pizza-calc__field">
          <span className="pizza-calc__label">Serving Other Food?</span>
          <div className="pizza-calc__toggle-group">
            <button
              type="button"
              className={`pizza-calc__toggle-btn${!servingOtherFood ? " pizza-calc__toggle-btn--active" : ""}`}
              onClick={() => setServingOtherFood(false)}
            >
              No
            </button>
            <button
              type="button"
              className={`pizza-calc__toggle-btn${servingOtherFood ? " pizza-calc__toggle-btn--active" : ""}`}
              onClick={() => setServingOtherFood(true)}
            >
              Yes
            </button>
          </div>
        </div>
      </div>

      {!result.ok ? (
        <p className="pizza-calc__message">{result.error}</p>
      ) : (
        <>
          <div className="pizza-calc__cards">
            <div className="pizza-calc__card pizza-calc__card--primary">
              <p className="pizza-calc__card-label">Pizzas Needed</p>
              <p className="pizza-calc__card-value">{result.pizzasNeeded}</p>
            </div>
            <div className="pizza-calc__card">
              <p className="pizza-calc__card-label">Total Slices</p>
              <p className="pizza-calc__card-value">
                {result.totalSlicesNeeded}
                <span className="pizza-calc__card-unit">slices</span>
              </p>
            </div>
            <div className="pizza-calc__card">
              <p className="pizza-calc__card-label">Leftover Slices</p>
              <p className="pizza-calc__card-value">
                {result.leftoverSlices}
                <span className="pizza-calc__card-unit">slices</span>
              </p>
            </div>
          </div>

          <div className="pizza-calc__visual">
            {Array.from(
              { length: Math.min(result.pizzasNeeded, MAX_VISUAL_PIZZAS) },
              (_, i) => (
                <PizzaSvg key={i} slices={result.slicesPerPizza} />
              ),
            )}
            {result.pizzasNeeded > MAX_VISUAL_PIZZAS && (
              <span className="pizza-calc__overflow">
                +{result.pizzasNeeded - MAX_VISUAL_PIZZAS} more
              </span>
            )}
          </div>

          <div className="pizza-calc__formula">
            <p className="pizza-calc__formula-title">Breakdown</p>
            <p className="pizza-calc__formula-text">
              ({result.adults} adults x {result.adultSlices} slices)
              {result.children > 0 &&
                ` + (${result.children} children x ${result.childSlices} slices)`}{" "}
              = {result.adults * result.adultSlices + result.children * result.childSlices} slices
            </p>
            {result.servingOtherFood && (
              <p className="pizza-calc__formula-text">
                x 0.75 (other food) = {result.totalSlicesNeeded} slices
              </p>
            )}
            <p className="pizza-calc__formula-text">
              {result.totalSlicesNeeded} slices / {result.slicesPerPizza} slices per pizza ={" "}
              {result.pizzasNeeded} pizza{result.pizzasNeeded !== 1 ? "s" : ""}
            </p>
            <p className="pizza-calc__formula-text">
              {result.pizzasNeeded} x {result.slicesPerPizza} = {result.totalSlicesOrdered} slices
              ordered ({result.leftoverSlices} leftover)
            </p>
          </div>
        </>
      )}
    </div>
  );
}
