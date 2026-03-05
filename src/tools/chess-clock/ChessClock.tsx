import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type Side = "top" | "bottom";
type Status = "idle" | "running" | "paused" | "gameOver";

type Settings = {
    minutesPerSide: number;
    incrementSeconds: number;
    soundsEnabled: boolean;
    topUpsideDown: boolean;
};

const DEFAULT_SETTINGS: Settings = {
    minutesPerSide: 10,
    incrementSeconds: 0,
    soundsEnabled: true,
    topUpsideDown: false,
};

const TICK_MS = 40;

function clampMinutes(value: number) {
    if (!Number.isFinite(value)) return DEFAULT_SETTINGS.minutesPerSide;
    return Math.min(180, Math.max(1, Math.floor(value)));
}

function clampIncrement(value: number) {
    if (!Number.isFinite(value)) return DEFAULT_SETTINGS.incrementSeconds;
    return Math.min(60, Math.max(0, Math.floor(value)));
}

function shouldDefaultTopUpsideDown() {
    if (typeof navigator === "undefined" || typeof window === "undefined") return false;

    const ua = navigator.userAgent || "";
    const isMobileUa = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(ua);
    const hasCoarsePointer = window.matchMedia?.("(pointer: coarse)")?.matches ?? false;
    const hasTouch = navigator.maxTouchPoints > 0;

    return isMobileUa || (hasCoarsePointer && hasTouch);
}

function formatClock(ms: number) {
    const safe = Math.max(0, ms);

    if (safe < 60_000 && safe > 0) {
        const totalCentiseconds = Math.floor(safe / 10);
        const seconds = Math.floor(totalCentiseconds / 100);
        const centiseconds = totalCentiseconds % 100;
        return `${String(seconds).padStart(2, "0")}:${String(centiseconds).padStart(2, "0")}`;
    }

    const totalSeconds = Math.floor(safe / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    }

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function ChessClock() {
    const initialMs = DEFAULT_SETTINGS.minutesPerSide * 60_000;

    const [settingsApplied, setSettingsApplied] = useState<Settings>(DEFAULT_SETTINGS);
    const [settingsDraft, setSettingsDraft] = useState<Settings>(DEFAULT_SETTINGS);
    const [topMs, setTopMs] = useState(initialMs);
    const [bottomMs, setBottomMs] = useState(initialMs);
    const [activeSide, setActiveSide] = useState<Side | null>(null);
    const [status, setStatus] = useState<Status>("idle");
    const [loser, setLoser] = useState<Side | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showOptions, setShowOptions] = useState(false);

    const intervalRef = useRef<number | null>(null);
    const lastTickRef = useRef<number>(0);
    const audioCtxRef = useRef<AudioContext | null>(null);

    const appliedStartMs = useMemo(() => settingsApplied.minutesPerSide * 60_000, [settingsApplied.minutesPerSide]);

    const stopTicking = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        const autoUpsideDown = shouldDefaultTopUpsideDown();
        if (!autoUpsideDown) return;

        setSettingsApplied((prev) => ({ ...prev, topUpsideDown: true }));
        setSettingsDraft((prev) => ({ ...prev, topUpsideDown: true }));
    }, []);

    const resetGame = useCallback((settings = settingsApplied) => {
        const startMs = settings.minutesPerSide * 60_000;
        stopTicking();
        setTopMs(startMs);
        setBottomMs(startMs);
        setActiveSide(null);
        setStatus("idle");
        setLoser(null);
    }, [settingsApplied, stopTicking]);

    const getAudioContext = useCallback(async () => {
        if (!audioCtxRef.current) {
            audioCtxRef.current = new AudioContext();
        }
        if (audioCtxRef.current.state === "suspended") {
            await audioCtxRef.current.resume();
        }
        return audioCtxRef.current;
    }, []);

    const playTapSound = useCallback(async () => {
        if (!settingsApplied.soundsEnabled) return;

        try {
            const ctx = await getAudioContext();
            const now = ctx.currentTime;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "triangle";
            osc.frequency.setValueAtTime(900, now);
            osc.frequency.exponentialRampToValueAtTime(600, now + 0.06);

            gain.gain.setValueAtTime(0.0001, now);
            gain.gain.exponentialRampToValueAtTime(0.18, now + 0.005);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.075);

            osc.connect(gain).connect(ctx.destination);
            osc.start(now);
            osc.stop(now + 0.08);
        } catch {
            // Ignore audio failures silently.
        }
    }, [getAudioContext, settingsApplied.soundsEnabled]);

    useEffect(() => {
        if (status !== "running" || !activeSide) {
            stopTicking();
            return;
        }

        lastTickRef.current = performance.now();

        const tick = () => {
            const now = performance.now();
            const deltaMs = Math.max(0, now - lastTickRef.current);
            lastTickRef.current = now;

            if (activeSide === "top") {
                setTopMs((prev) => {
                    const next = Math.max(0, prev - deltaMs);
                    if (next <= 0) {
                        setStatus("gameOver");
                        setLoser("top");
                        setActiveSide(null);
                    }
                    return next;
                });
            } else {
                setBottomMs((prev) => {
                    const next = Math.max(0, prev - deltaMs);
                    if (next <= 0) {
                        setStatus("gameOver");
                        setLoser("bottom");
                        setActiveSide(null);
                    }
                    return next;
                });
            }
        };

        intervalRef.current = window.setInterval(tick, TICK_MS);

        return stopTicking;
    }, [activeSide, status, stopTicking]);

    useEffect(() => {
        return () => {
            stopTicking();
            audioCtxRef.current?.close();
        };
    }, [stopTicking]);

    const onClockTap = useCallback((tappedSide: Side) => {
        if (status === "paused" || status === "gameOver") return;

        if (status === "idle") {
            const nextActive = tappedSide === "top" ? "bottom" : "top";
            setActiveSide(nextActive);
            setStatus("running");
            void playTapSound();
            return;
        }

        if (status !== "running") return;

        if (tappedSide !== activeSide) return;

        const incrementMs = settingsApplied.incrementSeconds * 1000;
        if (incrementMs > 0) {
            if (tappedSide === "top") {
                setTopMs((prev) => prev + incrementMs);
            } else {
                setBottomMs((prev) => prev + incrementMs);
            }
        }

        setActiveSide(tappedSide === "top" ? "bottom" : "top");
        void playTapSound();
    }, [activeSide, playTapSound, settingsApplied.incrementSeconds, status]);

    const onPausePlay = () => {
        if (status === "running") {
            setStatus("paused");
            return;
        }
        if (status === "paused" && activeSide) {
            setStatus("running");
        }
    };

    const onOpenOptions = () => {
        if (status === "running") {
            setStatus("paused");
        }
        setSettingsDraft(settingsApplied);
        setShowOptions(true);
    };

    const onOpenResetConfirm = () => {
        if (status === "running") {
            setStatus("paused");
        }
        setShowResetConfirm(true);
    };

    const onSaveOptions = () => {
        const next: Settings = {
            minutesPerSide: clampMinutes(settingsDraft.minutesPerSide),
            incrementSeconds: clampIncrement(settingsDraft.incrementSeconds),
            soundsEnabled: settingsDraft.soundsEnabled,
            topUpsideDown: settingsDraft.topUpsideDown,
        };

        setSettingsApplied(next);
        setShowOptions(false);
        resetGame(next);
    };

    const clockPanelStyle = (side: Side): React.CSSProperties => {
        const isActive = status === "running" && activeSide === side;
        const isLoser = status === "gameOver" && loser === side;

        return {
            ...styles.clockPanel,
            background: isLoser ? "#fee2e2" : isActive ? "#dcfce7" : "#f8fafc",
            borderColor: isLoser ? "#ef4444" : isActive ? "#22c55e" : "#d1d5db",
            cursor: status === "paused" || status === "gameOver" ? "default" : "pointer",
            opacity: status === "paused" ? 0.9 : 1,
        };
    };

    const pauseIcon = status === "paused"
        ? <span aria-hidden="true" style={styles.iconText}>▶</span>
        : <span aria-hidden="true" style={styles.iconText}>⏸</span>;

    return (
        <div style={styles.page}>
            <div style={styles.board}>
                <button type="button" style={clockPanelStyle("top")} onClick={() => onClockTap("top")}>
                    <span
                        style={{
                            ...styles.clockText,
                            transform: settingsApplied.topUpsideDown ? "rotate(180deg)" : "none",
                        }}
                    >
                        {formatClock(topMs)}
                    </span>
                </button>

                <div style={styles.controls}>
                    <button type="button" style={styles.controlButton} onClick={onOpenResetConfirm} aria-label="Reset game">
                        ↺
                    </button>
                    <button
                        type="button"
                        style={{ ...styles.controlButton, ...styles.primaryControl }}
                        onClick={onPausePlay}
                        disabled={status === "idle" || status === "gameOver"}
                        aria-label={status === "paused" ? "Resume" : "Pause"}
                    >
                        {pauseIcon}
                    </button>
                    <button type="button" style={styles.controlButton} onClick={onOpenOptions} aria-label="Open options">
                        ⚙
                    </button>
                </div>

                <button type="button" style={clockPanelStyle("bottom")} onClick={() => onClockTap("bottom")}>
                    <span style={styles.clockText}>{formatClock(bottomMs)}</span>
                </button>
            </div>

            {showResetConfirm && (
                <div style={styles.modalBackdrop} role="presentation">
                    <div style={styles.modal} role="dialog" aria-modal="true" aria-label="Reset confirmation">
                        <h2 style={styles.modalTitle}>Reset game?</h2>
                        <p style={styles.modalText}>Both clocks will return to {Math.floor(appliedStartMs / 60_000)}:00.</p>
                        <div style={styles.modalActions}>
                            <button type="button" style={styles.modalButton} onClick={() => setShowResetConfirm(false)}>Cancel</button>
                            <button
                                type="button"
                                style={{ ...styles.modalButton, ...styles.dangerButton }}
                                onClick={() => {
                                    setShowResetConfirm(false);
                                    resetGame();
                                }}
                            >
                                Reset game
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showOptions && (
                <div style={styles.modalBackdrop} role="presentation">
                    <div style={styles.modal} role="dialog" aria-modal="true" aria-label="Clock options">
                        <h2 style={styles.modalTitle}>Options</h2>

                        <label style={styles.fieldLabel}>
                            Time per side (minutes)
                            <input
                                type="number"
                                min={1}
                                max={180}
                                value={settingsDraft.minutesPerSide}
                                onChange={(e) => setSettingsDraft((prev) => ({
                                    ...prev,
                                    minutesPerSide: clampMinutes(Number(e.target.value)),
                                }))}
                                style={styles.input}
                            />
                        </label>

                        <label style={styles.fieldLabel}>
                            Increment per move (seconds)
                            <input
                                type="number"
                                min={0}
                                max={60}
                                value={settingsDraft.incrementSeconds}
                                onChange={(e) => setSettingsDraft((prev) => ({
                                    ...prev,
                                    incrementSeconds: clampIncrement(Number(e.target.value)),
                                }))}
                                style={styles.input}
                            />
                        </label>

                        <label style={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={settingsDraft.soundsEnabled}
                                onChange={(e) => setSettingsDraft((prev) => ({
                                    ...prev,
                                    soundsEnabled: e.target.checked,
                                }))}
                            />
                            Enable sounds
                        </label>

                        <label style={styles.checkboxRow}>
                            <input
                                type="checkbox"
                                checked={settingsDraft.topUpsideDown}
                                onChange={(e) => setSettingsDraft((prev) => ({
                                    ...prev,
                                    topUpsideDown: e.target.checked,
                                }))}
                            />
                            Top time upside down
                        </label>

                        <div style={styles.modalActions}>
                            <button type="button" style={styles.modalButton} onClick={() => setShowOptions(false)}>Cancel</button>
                            <button type="button" style={{ ...styles.modalButton, ...styles.primaryButton }} onClick={onSaveOptions}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        height: "calc(100vh - 72px)",
        width: "100%",
        padding: 0,
        margin: 0,
    },
    board: {
        width: "100%",
        height: "100%",
        border: "none",
        borderRadius: 0,
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "1fr auto 1fr",
        background: "#fff",
        boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
    },
    clockPanel: {
        width: "100%",
        border: "none",
        borderTop: "1px solid #d1d5db",
        borderBottom: "1px solid #d1d5db",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.3rem",
        padding: "1.2rem 0.75rem",
        transition: "background 120ms ease, border-color 120ms ease",
    },
    clockText: {
        fontSize: "clamp(2.2rem, 12vw, 5rem)",
        lineHeight: 1,
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace",
        fontWeight: 700,
        color: "#0f172a",
        letterSpacing: "0.04em",
    },
    controls: {
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        alignItems: "center",
        gap: "0.75rem",
        borderTop: "1px solid #d1d5db",
        borderBottom: "1px solid #d1d5db",
        padding: "0.6rem 0.75rem",
        background: "#f8fafc",
    },
    controlButton: {
        justifySelf: "center",
        border: "1px solid #94a3b8",
        background: "#fff",
        color: "#0f172a",
        width: "52px",
        height: "42px",
        borderRadius: "999px",
        fontSize: "1.2rem",
        fontWeight: 700,
        cursor: "pointer",
    },
    primaryControl: {
        width: "68px",
        height: "44px",
    },
    iconText: {
        display: "inline-block",
        transform: "translateY(-1px)",
    },
    modalBackdrop: {
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.4)",
        display: "grid",
        placeItems: "center",
        padding: "1rem",
        zIndex: 50,
    },
    modal: {
        width: "min(420px, 100%)",
        background: "#fff",
        borderRadius: "12px",
        border: "1px solid #d1d5db",
        boxShadow: "0 12px 40px rgba(15, 23, 42, 0.2)",
        padding: "1rem",
        display: "grid",
        gap: "0.9rem",
    },
    modalTitle: {
        margin: 0,
        fontSize: "1.2rem",
        color: "#0f172a",
    },
    modalText: {
        margin: 0,
        color: "#334155",
    },
    fieldLabel: {
        display: "grid",
        gap: "0.4rem",
        fontSize: "0.95rem",
        color: "#334155",
    },
    input: {
        border: "1px solid #cbd5e1",
        borderRadius: "8px",
        padding: "0.55rem 0.7rem",
        fontSize: "1rem",
    },
    checkboxRow: {
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        color: "#334155",
    },
    modalActions: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "0.6rem",
        marginTop: "0.2rem",
    },
    modalButton: {
        border: "1px solid #94a3b8",
        background: "#fff",
        color: "#0f172a",
        borderRadius: "8px",
        padding: "0.45rem 0.9rem",
        fontWeight: 600,
        cursor: "pointer",
    },
    primaryButton: {
        borderColor: "#1d4ed8",
        background: "#2563eb",
        color: "#fff",
    },
    dangerButton: {
        borderColor: "#dc2626",
        background: "#ef4444",
        color: "#fff",
    },
};
