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
    const modalRef = useRef<HTMLDivElement | null>(null);
    const modalTriggerRef = useRef<HTMLButtonElement | null>(null);

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

    useEffect(() => {
        if (!showOptions && !showResetConfirm) return;

        const dialog = modalRef.current;
        const focusableSelector = "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";
        const focusableElements = dialog ? Array.from(dialog.querySelectorAll<HTMLElement>(focusableSelector)) : [];
        const focusFrame = window.requestAnimationFrame(() => {
            (focusableElements[0] ?? dialog)?.focus();
        });

        const onModalKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault();
                setShowOptions(false);
                setShowResetConfirm(false);
                return;
            }

            if (event.key !== "Tab" || focusableElements.length === 0) return;

            const first = focusableElements[0];
            const last = focusableElements[focusableElements.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        document.addEventListener("keydown", onModalKeyDown);
        return () => {
            window.cancelAnimationFrame(focusFrame);
            document.removeEventListener("keydown", onModalKeyDown);
            window.requestAnimationFrame(() => modalTriggerRef.current?.focus());
        };
    }, [showOptions, showResetConfirm]);

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

    const onOpenOptions = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (status === "running") {
            setStatus("paused");
        }
        modalTriggerRef.current = event.currentTarget;
        setSettingsDraft(settingsApplied);
        setShowOptions(true);
    };

    const onOpenResetConfirm = (event: React.MouseEvent<HTMLButtonElement>) => {
        if (status === "running") {
            setStatus("paused");
        }
        modalTriggerRef.current = event.currentTarget;
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
            background: isLoser ? "var(--ui-color-danger-surface)" : isActive ? "var(--ui-color-success-surface)" : "var(--ui-color-surface-inset)",
            borderColor: isLoser ? "var(--ui-color-danger)" : isActive ? "var(--ui-color-success)" : "var(--ui-color-border)",
            cursor: status === "paused" || status === "gameOver" ? "default" : "pointer",
            opacity: status === "paused" ? 0.9 : 1,
        };
    };

    const pauseIcon = status === "paused"
        ? <span aria-hidden="true" style={styles.iconText}>▶</span>
        : <span aria-hidden="true" style={styles.iconText}>⏸</span>;

    return (
        <section className="chess-clock" style={styles.page} aria-label="Chess clock">
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

                <div style={styles.controls} role="toolbar" aria-label="Game controls">
                    <button type="button" className="ui-button ui-icon-button" data-variant="secondary" onClick={onOpenResetConfirm} aria-label="Reset game">
                        ↺
                    </button>
                    <button
                        type="button"
                        className="ui-button ui-icon-button"
                        onClick={onPausePlay}
                        disabled={status === "idle" || status === "gameOver"}
                        aria-label={status === "paused" ? "Resume" : "Pause"}
                    >
                        {pauseIcon}
                    </button>
                    <button type="button" className="ui-button ui-icon-button" data-variant="secondary" onClick={onOpenOptions} aria-label="Open options">
                        ⚙
                    </button>
                </div>

                <button type="button" style={clockPanelStyle("bottom")} onClick={() => onClockTap("bottom")}>
                    <span style={styles.clockText}>{formatClock(bottomMs)}</span>
                </button>
            </div>

            {showResetConfirm && (
                <div className="ui-modal-backdrop" role="presentation">
                    <div ref={modalRef} className="ui-modal ui-stack" role="dialog" aria-modal="true" aria-label="Reset confirmation" tabIndex={-1}>
                        <h2>Reset game?</h2>
                        <p className="ui-muted">Both clocks will return to {Math.floor(appliedStartMs / 60_000)}:00.</p>
                        <div className="ui-action-bar">
                            <button className="ui-button" data-variant="secondary" type="button" onClick={() => setShowResetConfirm(false)}>Cancel</button>
                            <button
                                className="ui-button"
                                data-variant="danger"
                                type="button"
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
                <div className="ui-modal-backdrop" role="presentation">
                    <div ref={modalRef} className="ui-modal ui-stack" role="dialog" aria-modal="true" aria-label="Clock options" tabIndex={-1}>
                        <h2>Options</h2>

                        <label className="ui-field">
                            <span className="ui-label">Time per side (minutes)</span>
                            <input
                                className="ui-input"
                                type="number"
                                min={1}
                                max={180}
                                value={settingsDraft.minutesPerSide}
                                onChange={(e) => setSettingsDraft((prev) => ({
                                    ...prev,
                                    minutesPerSide: clampMinutes(Number(e.target.value)),
                                }))}
                            />
                        </label>

                        <label className="ui-field">
                            <span className="ui-label">Increment per move (seconds)</span>
                            <input
                                className="ui-input"
                                type="number"
                                min={0}
                                max={60}
                                value={settingsDraft.incrementSeconds}
                                onChange={(e) => setSettingsDraft((prev) => ({
                                    ...prev,
                                    incrementSeconds: clampIncrement(Number(e.target.value)),
                                }))}
                            />
                        </label>

                        <label className="ui-choice">
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

                        <label className="ui-choice">
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

                        <div className="ui-action-bar">
                            <button className="ui-button" data-variant="secondary" type="button" onClick={() => setShowOptions(false)}>Cancel</button>
                            <button className="ui-button" type="button" onClick={onSaveOptions}>Save</button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}

const styles: Record<string, React.CSSProperties> = {
    page: {
        height: "calc(100dvh - 4.5rem - 1px)",
        minHeight: "30rem",
        width: "100%",
        padding: 0,
        margin: 0,
        overflow: "hidden",
    },
    board: {
        width: "100%",
        height: "100%",
        padding: 0,
        border: "none",
        borderRadius: 0,
        overflow: "hidden",
        display: "grid",
        gridTemplateRows: "1fr auto 1fr",
        background: "var(--ui-color-surface)",
        boxShadow: "none",
    },
    clockPanel: {
        width: "100%",
        border: "none",
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
        color: "var(--ui-color-text)",
        letterSpacing: "0.04em",
    },
    controls: {
        display: "grid",
        gridTemplateColumns: "repeat(3, var(--ui-control-height-md))",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--ui-space-4)",
        borderTop: "1px solid var(--ui-color-border)",
        borderBottom: "1px solid var(--ui-color-border)",
        borderRadius: 0,
        padding: "var(--ui-space-3) var(--ui-space-4)",
        background: "var(--ui-color-surface-inset)",
        boxShadow: "none",
    },
    iconText: {
        display: "inline-block",
        transform: "translateY(-1px)",
    },
};
