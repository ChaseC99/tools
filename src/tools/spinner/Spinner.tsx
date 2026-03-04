import { useMemo, useRef, useState, type CSSProperties, type TransitionEvent } from "react";
import {
    chooseExtraTurns,
    chooseWinnerIndex,
    computeTargetRotation,
    parseOptions,
    removeOptionAtIndex,
} from "./spinnerLogic.mjs";

const WHEEL_SIZE = 320;
const LABEL_RADIUS = 82;
const SPIN_DURATION_MS = 4000;
const DENSE_LABEL_THRESHOLD = 12;

const placeholder = ["Pizza", "Sushi", "Burgers", "Tacos", "Salad"].join("\n");

function getRandomUnit(): number {
    if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
        const values = new Uint32Array(1);
        crypto.getRandomValues(values);
        return values[0] / 0xffffffff;
    }

    return Math.random();
}

function generateRandomColor(): string {
    const hue = Math.floor(getRandomUnit() * 360);
    const saturation = 65 + Math.floor(getRandomUnit() * 20);
    const lightness = 50 + Math.floor(getRandomUnit() * 10);
    return `hsl(${hue} ${saturation}% ${lightness}%)`;
}

function buildWheelGradient(optionCount: number, colors: string[]) {
    if (optionCount < 2) {
        return "radial-gradient(circle at center, #f8fafc 0%, #e2e8f0 100%)";
    }

    const sliceSize = 100 / optionCount;
    const stops = Array.from({ length: optionCount }, (_, index) => {
        const start = (index * sliceSize).toFixed(4);
        const end = ((index + 1) * sliceSize).toFixed(4);
        const color = colors[index] ?? generateRandomColor();
        return `${color} ${start}% ${end}%`;
    }).join(", ");

    return `conic-gradient(from 0deg, ${stops})`;
}

export default function Spinner() {
    const [inputText, setInputText] = useState(placeholder);
    const [removeAfterSpin, setRemoveAfterSpin] = useState(false);
    const [isSpinning, setIsSpinning] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [pendingRemovalIndex, setPendingRemovalIndex] = useState<number | null>(null);
    const [rotationDeg, setRotationDeg] = useState(0);
    const [lastWinner, setLastWinner] = useState<string | null>(null);
    const pendingWinnerRef = useRef<number | null>(null);

    const options = useMemo<string[]>(() => parseOptions(inputText), [inputText]);
    const sliceColors = useMemo<string[]>(() => options.map(() => generateRandomColor()), [options]);
    const canSpin = options.length >= 2 && !isSpinning;
    const sliceAngle = options.length > 0 ? 360 / options.length : 0;
    const wheelBackground = useMemo(() => buildWheelGradient(options.length, sliceColors), [options.length, sliceColors]);
    const useDenseLabelMode = options.length >= DENSE_LABEL_THRESHOLD;
    const activeLabelRadius = useDenseLabelMode ? 106 : LABEL_RADIUS;

    const spin = () => {
        if (!canSpin) return;

        let activeInput = inputText;
        if (removeAfterSpin && pendingRemovalIndex !== null) {
            activeInput = removeOptionAtIndex(inputText, pendingRemovalIndex);
            setInputText(activeInput);
            setPendingRemovalIndex(null);
        }

        const activeOptions = parseOptions(activeInput);
        if (activeOptions.length < 2) {
            setSelectedIndex(null);
            setLastWinner(null);
            return;
        }

        const winnerIndex = chooseWinnerIndex(activeOptions.length);
        const extraTurns = chooseExtraTurns();
        const targetRotation = computeTargetRotation({
            currentRotation: rotationDeg,
            winnerIndex,
            optionCount: activeOptions.length,
            extraTurns,
        });

        pendingWinnerRef.current = winnerIndex;
        setLastWinner(null);
        setSelectedIndex(null);
        setIsSpinning(true);
        setRotationDeg(targetRotation);
    };

    const clearAll = () => {
        if (isSpinning) return;
        setInputText("");
        setRemoveAfterSpin(false);
        setSelectedIndex(null);
        setLastWinner(null);
        setPendingRemovalIndex(null);
        setRotationDeg(0);
        pendingWinnerRef.current = null;
    };

    const handleTransitionEnd = (event: TransitionEvent<HTMLDivElement>) => {
        if (event.propertyName !== "transform" || !isSpinning) return;

        setIsSpinning(false);

        const winnerIndex = pendingWinnerRef.current;
        pendingWinnerRef.current = null;
        if (winnerIndex === null) return;

        const winningOption = options[winnerIndex] ?? null;
        setLastWinner(winningOption);

        setSelectedIndex(winnerIndex);
        setPendingRemovalIndex(removeAfterSpin ? winnerIndex : null);
    };

    const wheelLabels = options.map((option, index) => {
        const centerAngle = sliceAngle * index + sliceAngle / 2;
        const theta = ((centerAngle - 90) * Math.PI) / 180;
        const x = WHEEL_SIZE / 2 + activeLabelRadius * Math.cos(theta);
        const y = WHEEL_SIZE / 2 + activeLabelRadius * Math.sin(theta);
        const rotation = useDenseLabelMode ? centerAngle - 90 : centerAngle;
        const isSelected = selectedIndex === index;
        return (
            <div
                key={`${option}-${index}`}
                style={{
                    ...styles.label,
                    ...(useDenseLabelMode ? styles.labelDense : null),
                    left: `${x}px`,
                    top: `${y}px`,
                    transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                    fontWeight: isSelected ? 800 : 600,
                    textShadow: isSelected
                        ? "0 0 6px rgba(255, 255, 255, 0.85)"
                        : "0 1px 2px rgba(0, 0, 0, 0.35)",
                }}
                title={option}
            >
                {option}
            </div>
        );
    });

    const sliceStrokes = options.length >= 2
        ? Array.from({ length: options.length }, (_, index) => {
            const boundaryAngle = sliceAngle * index;
            const theta = ((boundaryAngle - 90) * Math.PI) / 180;
            const x2 = WHEEL_SIZE / 2 + (WHEEL_SIZE / 2) * Math.cos(theta);
            const y2 = WHEEL_SIZE / 2 + (WHEEL_SIZE / 2) * Math.sin(theta);
            return (
                <line
                    key={`slice-stroke-${index}`}
                    x1={WHEEL_SIZE / 2}
                    y1={WHEEL_SIZE / 2}
                    x2={x2}
                    y2={y2}
                />
            );
        })
        : null;

    return (
        <section style={styles.container}>
            <div style={styles.wheelPanel}>
                <div style={styles.pointer} aria-hidden="true" />
                <div
                    style={{
                        ...styles.wheel,
                        background: wheelBackground,
                        transform: `rotate(${rotationDeg}deg)`,
                        transition: isSpinning ? `transform ${SPIN_DURATION_MS}ms cubic-bezier(0.12, 0.82, 0.22, 1)` : "none",
                    }}
                    onTransitionEnd={handleTransitionEnd}
                >
                    <svg viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`} style={styles.sliceStrokeOverlay} aria-hidden="true">
                        {sliceStrokes}
                    </svg>
                    {wheelLabels}
                </div>

                <button type="button" onClick={spin} disabled={!canSpin} style={styles.primaryButton}>
                    {isSpinning ? "Spinning..." : "Spin"}
                </button>

                <p style={styles.winnerText} aria-live="polite">
                    {lastWinner ? `Winner: ${lastWinner}` : "Winner: -"}
                </p>
            </div>

            <div style={styles.inputPanel}>
                <label htmlFor="spinner-options" style={styles.labelText}>Options (one per line)</label>
                <textarea
                    id="spinner-options"
                    value={inputText}
                    onChange={(event) => {
                        setInputText(event.target.value);
                        setPendingRemovalIndex(null);
                        setSelectedIndex(null);
                    }}
                    rows={8}
                    placeholder={placeholder}
                    style={styles.textarea}
                    disabled={isSpinning}
                />
                <div style={styles.controlRow}>
                    <label style={styles.toggleLabel}>
                        <input
                            type="checkbox"
                            checked={removeAfterSpin}
                            onChange={(event) => {
                                const checked = event.target.checked;
                                setRemoveAfterSpin(checked);
                                if (!checked) {
                                    setPendingRemovalIndex(null);
                                }
                            }}
                            disabled={isSpinning}
                        />
                        Remove winner after spin
                    </label>
                    <button type="button" onClick={clearAll} style={styles.secondaryButton} disabled={isSpinning}>
                        Clear
                    </button>
                </div>
            </div>            
        </section>
    );
}

const styles: Record<string, CSSProperties> = {
    container: {
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        alignItems: "center",
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "24px 16px 40px",
        overflowX: "hidden",
    },
    inputPanel: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "100%",
    },
    labelText: {
        fontWeight: 700,
        color: "#0f172a",
    },
    textarea: {
        width: "100%",
        boxSizing: "border-box",
        borderRadius: "10px",
        border: "1px solid #cbd5e1",
        padding: "12px",
        fontSize: "16px",
        lineHeight: 1.35,
        resize: "vertical",
        minHeight: "180px",
        fontFamily: "inherit",
        color: "#0f172a",
        backgroundColor: "#ffffff",
    },
    controlRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        flexWrap: "wrap",
    },
    toggleLabel: {
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        color: "#1e293b",
        fontSize: "15px",
    },
    secondaryButton: {
        border: "1px solid #94a3b8",
        borderRadius: "8px",
        backgroundColor: "#f8fafc",
        color: "#0f172a",
        padding: "8px 14px",
        fontWeight: 600,
        cursor: "pointer",
    },
    helpText: {
        margin: 0,
        fontSize: "14px",
        color: "#475569",
        minHeight: "20px",
    },
    wheelPanel: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "14px",
        position: "relative",
        width: `${WHEEL_SIZE + 16}px`,
    },
    pointer: {
        width: 0,
        height: 0,
        borderLeft: "12px solid transparent",
        borderRight: "12px solid transparent",
        borderTop: "20px solid #0f172a",
        marginBottom: "-6px",
        zIndex: 2,
    },
    wheel: {
        width: `${WHEEL_SIZE}px`,
        height: `${WHEEL_SIZE}px`,
        borderRadius: "50%",
        position: "relative",
        border: "8px solid #0f172a",
        boxShadow: "0 12px 24px rgba(15, 23, 42, 0.2)",
        backgroundColor: "#e2e8f0",
        overflow: "hidden",
    },
    label: {
        position: "absolute",
        width: "96px",
        textAlign: "center",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        color: "#0f172a",
        fontSize: "13px",
        lineHeight: 1.1,
        pointerEvents: "none",
    },
    labelDense: {
        width: "84px",
        fontSize: "11px",
    },
    sliceStrokeOverlay: {
        position: "absolute",
        inset: 0,
        overflow: "visible",
        pointerEvents: "none",
        stroke: "#020617",
        strokeWidth: 2,
        fill: "none",
    },
    primaryButton: {
        border: "none",
        borderRadius: "999px",
        backgroundColor: "#0f172a",
        color: "#ffffff",
        padding: "12px 30px",
        fontSize: "16px",
        fontWeight: 700,
        width: "160px",
        cursor: "pointer",
    },
    winnerText: {
        margin: 0,
        minHeight: "24px",
        fontSize: "18px",
        fontWeight: 700,
        color: "#0f172a",
    },
};
