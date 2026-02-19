import { useState, useEffect, useRef, useCallback } from "react";

type Tone = "bell" | "chime" | "buzzer" | "mute";

const TONES: { id: Tone; label: string }[] = [
    { id: "bell", label: "Bell" },
    { id: "chime", label: "Chime" },
    { id: "buzzer", label: "Buzzer" },
    { id: "mute", label: "Mute" },
];

function playTone(ctx: AudioContext, tone: Tone) {
    if (tone === "mute") return;
    const now = ctx.currentTime;

    if (tone === "bell") {
        [830, 1245].forEach((freq) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.35, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 1.8);
        });
    } else if (tone === "chime") {
        [523, 659, 784].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "triangle";
            osc.frequency.value = freq;
            const t = now + i * 0.2;
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.3, t + 0.05);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.6);
        });
    } else if (tone === "buzzer") {
        for (let i = 0; i < 3; i++) {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sawtooth";
            osc.frequency.value = 220;
            const t = now + i * 0.3;
            gain.gain.setValueAtTime(0.25, t);
            gain.gain.setValueAtTime(0, t + 0.15);
            osc.connect(gain).connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.3);
        }
    }
}

export default function Timer() {
    const [hours, setHours] = useState(0);
    const [minutes, setMinutes] = useState(5);
    const [seconds, setSeconds] = useState(0);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const [remaining, setRemaining] = useState(0);
    const [running, setRunning] = useState(false);
    const [finished, setFinished] = useState(false);
    const [tone, setTone] = useState<Tone>("bell");

    const intervalRef = useRef<number | null>(null);
    const flashTimeoutRef = useRef<number | null>(null);
    const endTimeRef = useRef(0);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const toneRef = useRef<Tone>(tone);

    // Keep toneRef in sync (so the interval callback sees the latest value)
    toneRef.current = tone;

    const getAudioCtx = useCallback(() => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext();
        }
        return audioCtxRef.current;
    }, []);

    // Clean up AudioContext on unmount
    useEffect(() => {
        return () => {
            audioCtxRef.current?.close();
        };
    }, []);

    const inputTotal = hours * 3600 + minutes * 60 + seconds;

    const clearTimers = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (flashTimeoutRef.current) {
            clearTimeout(flashTimeoutRef.current);
            flashTimeoutRef.current = null;
        }
    }, []);

    const start = useCallback(() => {
        if (inputTotal <= 0 && !running) return;

        const resumeSeconds = running ? remaining : inputTotal;
        if (!running) {
            setTotalSeconds(inputTotal);
            setRemaining(inputTotal);
        }

        endTimeRef.current = Date.now() + resumeSeconds * 1000;
        setFinished(false);
        setRunning(true);
    }, [inputTotal, running, remaining]);

    const pause = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        // Snapshot remaining from the wall clock so we don't lose fractional seconds
        const secsLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
        setRemaining(secsLeft);
        setRunning(false);
    }, []);

    const reset = useCallback(() => {
        clearTimers();
        setRunning(false);
        setFinished(false);
        setRemaining(0);
        setTotalSeconds(0);
    }, [clearTimers]);

    // Tick effect — uses wall-clock target to avoid drift
    useEffect(() => {
        if (!running) return;

        const tick = () => {
            const secsLeft = Math.max(0, Math.round((endTimeRef.current - Date.now()) / 1000));
            setRemaining(secsLeft);

            if (secsLeft <= 0) {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
                setRunning(false);
                setFinished(true);
                playTone(getAudioCtx(), toneRef.current);
                flashTimeoutRef.current = window.setTimeout(() => setFinished(false), 3000);
            }
        };

        intervalRef.current = window.setInterval(tick, 250);

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        };
    }, [running, getAudioCtx]);

    // Clean up flash timeout on unmount
    useEffect(() => {
        return () => {
            if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
        };
    }, []);

    const displayH = Math.floor(remaining / 3600);
    const displayM = Math.floor((remaining % 3600) / 60);
    const displayS = remaining % 60;
    const pad = (n: number) => String(n).padStart(2, "0");

    const progress = totalSeconds > 0 ? remaining / totalSeconds : 0;
    const ringSize = 300;
    const ringRadius = 130;
    const circumference = 2 * Math.PI * ringRadius;
    const strokeOffset = circumference * (1 - progress);

    const isActive = totalSeconds > 0;

    const previewTone = (t: Tone) => {
        setTone(t);
        playTone(getAudioCtx(), t);
    };

    return (
        <div style={styles.container}>
            <div style={{
                ...styles.ringWrap,
                width: ringSize,
                height: ringSize,
                animation: finished ? "timerFlash 0.4s ease-in-out 4" : "none",
            }}>
                <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                    <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
                    <circle
                        cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                        fill="none"
                        stroke={finished ? "#22c55e" : "#4f8cff"}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                        style={{ transition: running ? "stroke-dashoffset 0.25s linear" : "none" }}
                    />
                </svg>
                <div style={styles.timeOverlay}>
                    {isActive
                        ? `${pad(displayH)}:${pad(displayM)}:${pad(displayS)}`
                        : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
                    }
                </div>
            </div>

            {!isActive && (
                <div style={styles.inputs}>
                    <label style={styles.inputGroup}>
                        <input
                            type="number" min={0} max={99}
                            value={hours} onChange={(e) => setHours(Math.max(0, +e.target.value))}
                            style={styles.numInput}
                        />
                        <span style={styles.inputLabel}>hr</span>
                    </label>
                    <label style={styles.inputGroup}>
                        <input
                            type="number" min={0} max={59}
                            value={minutes} onChange={(e) => setMinutes(Math.min(59, Math.max(0, +e.target.value)))}
                            style={styles.numInput}
                        />
                        <span style={styles.inputLabel}>min</span>
                    </label>
                    <label style={styles.inputGroup}>
                        <input
                            type="number" min={0} max={59}
                            value={seconds} onChange={(e) => setSeconds(Math.min(59, Math.max(0, +e.target.value)))}
                            style={styles.numInput}
                        />
                        <span style={styles.inputLabel}>sec</span>
                    </label>
                </div>
            )}

            <div style={styles.buttons}>
                {!running ? (
                    <button onClick={start} disabled={!isActive && inputTotal <= 0} style={styles.button}>
                        {isActive ? "Resume" : "Start"}
                    </button>
                ) : (
                    <button onClick={pause} style={styles.button}>Pause</button>
                )}
                <button onClick={reset} style={{ ...styles.button, ...styles.resetButton }}>Reset</button>
            </div>

            <div style={styles.toneSection}>
                <span style={styles.toneLabel}>Alarm tone</span>
                <div style={styles.tonePills}>
                    {TONES.map((t) => (
                        <button
                            key={t.id}
                            onClick={() => previewTone(t.id)}
                            style={tone === t.id
                                ? { ...styles.tonePill, ...styles.tonePillActive }
                                : styles.tonePill
                            }
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <style>{`
                @keyframes timerFlash {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.3; }
                }
            `}</style>
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    container: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "28px",
        minHeight: "calc(100vh - 80px)",
    },
    ringWrap: {
        position: "relative",
    },
    timeOverlay: {
        position: "absolute",
        top: 0, left: 0, right: 0, bottom: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "48px",
        fontWeight: "bold",
        fontFamily: "monospace",
    },
    inputs: {
        display: "flex",
        gap: "16px",
    },
    inputGroup: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
    },
    numInput: {
        width: "64px",
        height: "48px",
        fontSize: "22px",
        textAlign: "center",
        border: "1px solid #ccc",
        borderRadius: "8px",
    },
    inputLabel: {
        fontSize: "12px",
        color: "#888",
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
    toneSection: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "8px",
    },
    toneLabel: {
        fontSize: "13px",
        color: "#888",
    },
    tonePills: {
        display: "flex",
        gap: "6px",
    },
    tonePill: {
        padding: "6px 14px",
        fontSize: "13px",
        border: "1px solid #ddd",
        borderRadius: "20px",
        background: "#fff",
        cursor: "pointer",
        color: "#555",
    },
    tonePillActive: {
        background: "#333",
        color: "#fff",
        borderColor: "#333",
    },
};
