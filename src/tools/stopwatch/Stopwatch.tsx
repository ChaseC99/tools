import { useState, useRef, useCallback } from "react";

interface Lap {
    id: number;
    time: number;
}

export default function Stopwatch() {
    const [elapsed, setElapsed] = useState(0);
    const [running, setRunning] = useState(false);
    const [laps, setLaps] = useState<Lap[]>([]);
    const [nextLapId, setNextLapId] = useState(1);
    const intervalRef = useRef<number | null>(null);
    const startTimeRef = useRef(0);
    const accumulatedRef = useRef(0);

    const start = useCallback(() => {
        startTimeRef.current = Date.now();
        accumulatedRef.current = elapsed;
        setRunning(true);
        intervalRef.current = window.setInterval(() => {
            setElapsed(accumulatedRef.current + (Date.now() - startTimeRef.current));
        }, 31);
    }, [elapsed]);

    const pause = () => {
        setRunning(false);
        accumulatedRef.current = elapsed;
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const reset = () => {
        setRunning(false);
        setElapsed(0);
        setLaps([]);
        accumulatedRef.current = 0;
        if (intervalRef.current) clearInterval(intervalRef.current);
    };

    const lap = () => {
        setLaps((prev) => [{ id: nextLapId, time: elapsed }, ...prev]);
        setNextLapId((n) => n + 1);
    };

    const formatTime = (ms: number) => {
        const totalSec = Math.floor(ms / 1000);
        const m = Math.floor(totalSec / 60);
        const s = totalSec % 60;
        const cs = Math.floor((ms % 1000) / 10);
        return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
    };

    return (
        <div style={styles.container}>
            <div style={styles.display}>{formatTime(elapsed)}</div>

            <div style={styles.buttons}>
                {!running ? (
                    <button onClick={start} style={styles.button}>
                        {elapsed > 0 ? "Resume" : "Start"}
                    </button>
                ) : (
                    <button onClick={pause} style={styles.button}>Pause</button>
                )}
                {running && (
                    <button onClick={lap} style={styles.button}>Lap</button>
                )}
                <button onClick={reset} style={{ ...styles.button, ...styles.resetButton }}>Reset</button>
            </div>

            {laps.length > 0 && (
                <div style={styles.lapList}>
                    <div style={styles.lapHeader}>
                        <span>Lap</span>
                        <span>Time</span>
                    </div>
                    {laps.map((l, i) => (
                        <div key={l.id} style={styles.lapRow}>
                            <span>#{laps.length - i}</span>
                            <span style={styles.lapTime}>{formatTime(l.time)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "32px",
        padding: "20px",
        minHeight: "calc(100vh - 80px)",
    },
    display: {
        fontSize: "min(20vw, 96px)",
        fontWeight: "bold",
        fontFamily: "monospace",
        letterSpacing: "2px",
    },
    buttons: {
        display: "flex",
        gap: "12px",
    },
    button: {
        padding: "12px 32px",
        fontSize: "18px",
        fontWeight: "bold",
        border: "2px solid #333",
        borderRadius: "8px",
        backgroundColor: "#fff",
        cursor: "pointer",
    },
    resetButton: {
        borderColor: "#999",
        color: "#666",
    },
    lapList: {
        width: "100%",
        maxWidth: "360px",
        display: "flex",
        flexDirection: "column",
        gap: "4px",
    },
    lapHeader: {
        display: "flex",
        justifyContent: "space-between",
        fontWeight: "bold",
        fontSize: "14px",
        color: "#888",
        borderBottom: "1px solid #e5e7eb",
        paddingBottom: "6px",
    },
    lapRow: {
        display: "flex",
        justifyContent: "space-between",
        padding: "8px 0",
        borderBottom: "1px solid #f0f0f0",
    },
    lapTime: {
        fontFamily: "monospace",
        fontSize: "16px",
    },
};
