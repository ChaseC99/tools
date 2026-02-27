import { useState, useCallback, useRef } from "react";

// Mulberry32 seeded PRNG
function mulberry32(seed: number): () => number {
    let s = seed;
    return () => {
        s = (s + 0x6D2B79F5) | 0;
        let t = Math.imul(s ^ (s >>> 15), 1 | s);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
}

type Face = "heads" | "tails";

interface HistoryEntry {
    result: Face;
    id: number;
}

export default function CoinFlip() {
    const [result, setResult] = useState<Face | null>(null);
    const [isFlipping, setIsFlipping] = useState(false);
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [flipCount, setFlipCount] = useState(0);
    const [nextId, setNextId] = useState(0);
    const rngRef = useRef(mulberry32(Math.floor(Math.random() * 0x100000000)));

    const flip = useCallback(() => {
        if (isFlipping) return;
        setIsFlipping(true);

        const outcome: Face = rngRef.current() < 0.5 ? "heads" : "tails";
        // Compute half-turns so the final parity matches the outcome:
        // even flipCount → heads face, odd flipCount → tails face
        setFlipCount((prev) => {
            const targetParity = outcome === "heads" ? 0 : 1;
            const base = 6;
            const halfTurns = (prev + base) % 2 === targetParity ? base : base + 1;
            return prev + halfTurns;
        });

        setTimeout(() => {
            setResult(outcome);
            setIsFlipping(false);
            setHistory((prev) => {
                const entry = { result: outcome, id: nextId };
                setNextId((n) => n + 1);
                const updated = [entry, ...prev];
                return updated.slice(0, 10);
            });
        }, 800);
    }, [isFlipping, nextId]);

    const headsCount = history.filter((h) => h.result === "heads").length;
    const tailsCount = history.filter((h) => h.result === "tails").length;

    const rotationDeg = flipCount * 180;

    return (
        <div style={styles.container}>
            <div style={styles.scene}>
                <div
                    style={{
                        ...styles.coin,
                        transform: `rotateY(${rotationDeg}deg) translateY(${isFlipping ? -40 : 0}px)`,
                        transition: isFlipping
                            ? "transform 0.8s cubic-bezier(0.4, 0, 0.2, 1)"
                            : "none",
                    }}
                >
                    <div style={{ ...styles.face, ...styles.faceHeads }}>
                        <div style={styles.coinInnerRing}>
                            <svg width="60" height="60" viewBox="0 0 60 60">
                                <text
                                    x="30" y="42"
                                    textAnchor="middle"
                                    fill="#8b6914"
                                    fontSize="44"
                                    fontFamily="Georgia, serif"
                                    fontWeight="bold"
                                >
                                    H
                                </text>
                            </svg>
                        </div>
                    </div>
                    <div style={{ ...styles.face, ...styles.faceTails }}>
                        <div style={styles.coinInnerRingTails}>
                            <svg width="60" height="60" viewBox="0 0 60 60">
                                <text
                                    x="30" y="42"
                                    textAnchor="middle"
                                    fill="#555"
                                    fontSize="44"
                                    fontFamily="Georgia, serif"
                                    fontWeight="bold"
                                >
                                    T
                                </text>
                            </svg>
                        </div>
                    </div>
                </div>
            </div>

            <p style={styles.resultText}>
                {result && !isFlipping
                    ? `${result === "heads" ? "Heads" : "Tails"}!`
                    : "\u00A0"}
            </p>

            <button onClick={flip} disabled={isFlipping} style={styles.button}>
                {isFlipping ? "Flipping..." : "Flip Coin"}
            </button>

            <div style={{
                ...styles.historySection,
                visibility: history.length > 0 ? "visible" : "hidden",
            }}>
                <div style={styles.tally}>
                    <span>H: {headsCount}</span>
                    <span style={{ margin: "0 12px", color: "#666" }}>|</span>
                    <span>T: {tailsCount}</span>
                </div>
                <div style={styles.chips}>
                    {history.length > 0
                        ? history.map((entry) => (
                            <span
                                key={entry.id}
                                style={{
                                    ...styles.chip,
                                    backgroundColor:
                                        entry.result === "heads"
                                            ? "#e8d44d"
                                            : "#b0b0b0",
                                    color:
                                        entry.result === "heads"
                                            ? "#6b5a00"
                                            : "#3a3a3a",
                                }}
                            >
                                {entry.result === "heads" ? "H" : "T"}
                            </span>
                        ))
                        : <span style={styles.chip}>{"\u00A0"}</span>
                    }
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
    scene: {
        perspective: "800px",
        width: "160px",
        height: "160px",
    },
    coin: {
        width: "160px",
        height: "160px",
        position: "relative",
        transformStyle: "preserve-3d",
    },
    face: {
        position: "absolute",
        width: "100%",
        height: "100%",
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backfaceVisibility: "hidden",
        boxSizing: "border-box",
    },
    faceHeads: {
        background: "radial-gradient(ellipse at 35% 35%, #fce96a 0%, #f5d442 30%, #d4a017 70%, #b8860b 100%)",
        border: "6px solid #a07608",
        boxShadow: "inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.3)",
    },
    faceTails: {
        background: "radial-gradient(ellipse at 35% 35%, #e8e8e8 0%, #c0c0c0 30%, #999 70%, #777 100%)",
        border: "6px solid #777",
        boxShadow: "inset 0 2px 6px rgba(255,255,255,0.4), inset 0 -3px 6px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.3)",
        transform: "rotateY(180deg)",
    },
    coinInnerRing: {
        width: "100px",
        height: "100px",
        borderRadius: "50%",
        border: "2px solid rgba(139, 105, 20, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    coinInnerRingTails: {
        width: "100px",
        height: "100px",
        borderRadius: "50%",
        border: "2px solid rgba(85, 85, 85, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
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
    tally: {
        fontSize: "16px",
        fontWeight: "bold",
    },
    chips: {
        display: "flex",
        gap: "6px",
        flexWrap: "wrap",
        justifyContent: "center",
    },
    chip: {
        width: "30px",
        height: "30px",
        borderRadius: "50%",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "13px",
        fontWeight: "bold",
    },
};
