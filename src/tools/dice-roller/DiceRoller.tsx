import { useState, useCallback, useRef, useEffect } from "react";

const DICE_PRESETS = [4, 6, 8, 10, 12, 20, 100] as const;

interface HistoryEntry {
    result: number;
    sides: number;
    id: number;
}

// Dot positions for a d6 face
const DOT_LAYOUTS: Record<number, [number, number][]> = {
    1: [[50, 50]],
    2: [[28, 28], [72, 72]],
    3: [[28, 28], [50, 50], [72, 72]],
    4: [[28, 28], [72, 28], [28, 72], [72, 72]],
    5: [[28, 28], [72, 28], [50, 50], [28, 72], [72, 72]],
    6: [[28, 28], [72, 28], [28, 50], [72, 50], [28, 72], [72, 72]],
};

export default function DiceRoller() {
    const [sides, setSides] = useState(6);
    const [result, setResult] = useState<number | null>(null);
    const [displayNum, setDisplayNum] = useState<number | null>(null);
    const [isRolling, setIsRolling] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [nextId, setNextId] = useState(0);
    const [animKey, setAnimKey] = useState(0);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const roll = useCallback(() => {
        if (isRolling) return;
        setIsRolling(true);
        setAnimKey((k) => k + 1);

        const outcome = Math.floor(Math.random() * sides) + 1;

        // Rapid number cycling
        let elapsed = 0;
        const tick = 50;
        intervalRef.current = setInterval(() => {
            elapsed += tick;
            setDisplayNum(Math.floor(Math.random() * sides) + 1);
            if (elapsed >= 700) {
                if (intervalRef.current) clearInterval(intervalRef.current);
            }
        }, tick);

        setTimeout(() => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setDisplayNum(outcome);
            setResult(outcome);
            setIsRolling(false);
            setHistory((prev) => {
                const entry = { result: outcome, sides, id: nextId };
                setNextId((n) => n + 1);
                return [entry, ...prev].slice(0, 10);
            });
        }, 800);
    }, [isRolling, sides, nextId]);

    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
        };
    }, []);

    const showDots = sides === 6 && displayNum !== null && displayNum >= 1 && displayNum <= 6;

    return (
        <div style={styles.container}>
            <style>{`
                @keyframes tumble-${animKey} {
                    0%   { transform: rotate(0deg)   scale(1);   }
                    15%  { transform: rotate(${-40 - Math.random() * 30}deg) scale(0.9) translateY(-30px); }
                    30%  { transform: rotate(${50 + Math.random() * 40}deg)  scale(1.05) translateY(-50px); }
                    50%  { transform: rotate(${-30 - Math.random() * 50}deg) scale(0.95) translateY(-35px); }
                    70%  { transform: rotate(${20 + Math.random() * 30}deg)  scale(1.02) translateY(-15px); }
                    85%  { transform: rotate(${-5 - Math.random() * 10}deg)  scale(1);   translateY(-5px); }
                    100% { transform: rotate(0deg) scale(1) translateY(0); }
                }
            `}</style>

            {/* Dice type selector */}
            <div style={styles.selector}>
                {DICE_PRESETS.map((d) => (
                    <button
                        key={d}
                        onClick={() => {
                            setSides(d);
                            setResult(null);
                            setDisplayNum(null);
                        }}
                        style={{
                            ...styles.selectorBtn,
                            ...(sides === d ? styles.selectorBtnActive : {}),
                        }}
                    >
                        d{d}
                    </button>
                ))}
            </div>

            {/* Die visual */}
            <div style={styles.dieScene}>
                <div
                    style={{
                        ...styles.die,
                        animation: isRolling
                            ? `tumble-${animKey} 0.8s cubic-bezier(0.22, 1, 0.36, 1)`
                            : "none",
                    }}
                >
                    {showDots ? (
                        <svg width="100%" height="100%" viewBox="0 0 100 100">
                            {DOT_LAYOUTS[displayNum].map(([cx, cy], i) => (
                                <circle
                                    key={i}
                                    cx={cx}
                                    cy={cy}
                                    r={9}
                                    fill="#1a1a1a"
                                />
                            ))}
                        </svg>
                    ) : (
                        <span style={styles.dieNumber}>
                            {displayNum ?? "?"}
                        </span>
                    )}
                </div>
            </div>

            {/* Result text */}
            <p style={styles.resultText}>
                {result !== null && !isRolling ? `${result}` : "\u00A0"}
            </p>

            {/* Roll button */}
            <button onClick={roll} disabled={isRolling} style={styles.button}>
                {isRolling ? "Rolling..." : `Roll d${sides}`}
            </button>

            {/* History */}
            <div
                style={{
                    ...styles.historySection,
                    visibility: history.length > 0 ? "visible" : "hidden",
                }}
            >
                <div style={styles.chips}>
                    {history.length > 0
                        ? history.map((entry) => (
                              <span key={entry.id} style={styles.chip}>
                                  <span style={styles.chipValue}>
                                      {entry.result}
                                  </span>
                                  <span style={styles.chipLabel}>
                                      d{entry.sides}
                                  </span>
                              </span>
                          ))
                        : null}
                </div>
            </div>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "20px",
        padding: "40px 20px",
        minHeight: "calc(100vh - 200px)",
        fontFamily: "inherit",
    },
    selector: {
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
        justifyContent: "center",
    },
    selectorBtn: {
        padding: "8px 16px",
        fontSize: "15px",
        fontWeight: "600",
        border: "2px solid #ddd",
        borderRadius: "8px",
        backgroundColor: "#fff",
        cursor: "pointer",
        transition: "all 0.15s",
        color: "#555",
    },
    selectorBtnActive: {
        borderColor: "#333",
        backgroundColor: "#333",
        color: "#fff",
    },
    dieScene: {
        width: "140px",
        height: "140px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    die: {
        width: "120px",
        height: "120px",
        borderRadius: "18px",
        background:
            "linear-gradient(145deg, #ffffff 0%, #f0f0f0 50%, #e0e0e0 100%)",
        border: "3px solid #ccc",
        boxShadow:
            "0 4px 12px rgba(0,0,0,0.15), inset 0 1px 3px rgba(255,255,255,0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transformOrigin: "center center",
    },
    dieNumber: {
        fontSize: "42px",
        fontWeight: "bold",
        color: "#1a1a1a",
        userSelect: "none",
    },
    resultText: {
        fontSize: "24px",
        fontWeight: "bold",
        margin: 0,
    },
    button: {
        padding: "12px 32px",
        fontSize: "18px",
        fontWeight: "bold",
        border: "2px solid #333",
        borderRadius: "8px",
        backgroundColor: "#fff",
        cursor: "pointer",
        transition: "background-color 0.15s",
    },
    historySection: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        marginTop: "10px",
    },
    chips: {
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        justifyContent: "center",
    },
    chip: {
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "40px",
        height: "48px",
        borderRadius: "10px",
        backgroundColor: "#f3f3f3",
        border: "1px solid #ddd",
    },
    chipValue: {
        fontSize: "16px",
        fontWeight: "bold",
        color: "#222",
        lineHeight: 1,
    },
    chipLabel: {
        fontSize: "10px",
        color: "#888",
        lineHeight: 1,
        marginTop: "2px",
    },
};
