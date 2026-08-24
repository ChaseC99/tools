import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

const MIN_SPEED = 100;
const MAX_SPEED = 500;
const DEFAULT_SPEED = 250;

const MIN_SIZE = 100;
const MAX_SIZE = 500;
const DEFAULT_SIZE = 250;

type PromptTheme = "dark" | "light";
type TextAlignMode = "left" | "center" | "right";

export default function Teleprompter() {
    const [text, setText] = useState("");
    const [speed, setSpeed] = useState(DEFAULT_SPEED);
    const [fontSize, setFontSize] = useState(DEFAULT_SIZE);
    const [theme, setTheme] = useState<PromptTheme>("dark");
    const [textAlign, setTextAlign] = useState<TextAlignMode>("left");

    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [hasEnded, setHasEnded] = useState(false);
    const [scrollOffsetPx, setScrollOffsetPx] = useState(0);
    const [isToolbarHovered, setIsToolbarHovered] = useState(false);

    const viewportRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef<number | null>(null);
    const accumulatedOffsetRef = useRef(0);
    const speedRef = useRef(speed);
    const lastFrameTimestampRef = useRef(0);
    const viewportHeightRef = useRef(0);
    const contentHeightRef = useRef(0);

    const stopAnimation = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
    }, []);

    useEffect(() => {
        speedRef.current = speed;
    }, [speed]);

    const measureViewportAndContent = useCallback(() => {
        const viewportHeight = viewportRef.current?.clientHeight ?? window.innerHeight;
        const contentHeight = contentRef.current?.scrollHeight ?? 0;
        viewportHeightRef.current = viewportHeight;
        contentHeightRef.current = contentHeight;
    }, []);

    const startAnimation = useCallback(() => {
        stopAnimation();
        lastFrameTimestampRef.current = performance.now();

        const step = (now: number) => {
            const elapsedMs = now - lastFrameTimestampRef.current;
            lastFrameTimestampRef.current = now;
            accumulatedOffsetRef.current += (elapsedMs * speedRef.current) / 1000;
            const currentOffset = accumulatedOffsetRef.current;
            const maxOffset = viewportHeightRef.current + contentHeightRef.current;

            if (currentOffset >= maxOffset) {
                const endOffset = Math.max(0, maxOffset);
                setScrollOffsetPx(endOffset);
                accumulatedOffsetRef.current = endOffset;
                setIsPaused(true);
                setHasEnded(true);
                stopAnimation();
                return;
            }

            setScrollOffsetPx(currentOffset);
            rafRef.current = requestAnimationFrame(step);
        };

        rafRef.current = requestAnimationFrame(step);
    }, [stopAnimation]);

    const enterPlayback = useCallback(async () => {
        setIsPlaying(true);
        setIsPaused(false);
        setHasEnded(false);
        setScrollOffsetPx(0);
        accumulatedOffsetRef.current = 0;
    }, []);

    const exitPlayback = useCallback(async () => {
        stopAnimation();
        setIsPlaying(false);
        setIsPaused(false);
        setHasEnded(false);
        setScrollOffsetPx(0);
        accumulatedOffsetRef.current = 0;
    }, [stopAnimation]);

    const pausePlayback = useCallback(() => {
        stopAnimation();
        setIsPaused(true);
    }, [stopAnimation]);

    const resumePlayback = useCallback(() => {
        if (hasEnded) return;
        setIsPaused(false);
        startAnimation();
    }, [hasEnded, startAnimation]);

    const restartPlayback = useCallback(() => {
        stopAnimation();
        setHasEnded(false);
        setIsPaused(false);
        setScrollOffsetPx(0);
        accumulatedOffsetRef.current = 0;
        startAnimation();
    }, [startAnimation, stopAnimation]);

    useEffect(() => {
        if (!isPlaying) return;

        measureViewportAndContent();
        if (contentHeightRef.current <= 0) {
            setIsPaused(true);
            setHasEnded(true);
            return;
        }

        startAnimation();

        const handleResize = () => {
            measureViewportAndContent();
        };

        window.addEventListener("resize", handleResize);
        return () => {
            window.removeEventListener("resize", handleResize);
            stopAnimation();
        };
    }, [isPlaying, measureViewportAndContent, startAnimation, stopAnimation]);

    useEffect(() => {
        if (!isPlaying) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === " ") {
                event.preventDefault();
                if (hasEnded) return;
                if (isPaused) {
                    resumePlayback();
                } else {
                    pausePlayback();
                }
                return;
            }

            if (event.key.toLowerCase() === "r") {
                event.preventDefault();
                restartPlayback();
                return;
            }

            if (event.key === "Escape") {
                event.preventDefault();
                void exitPlayback();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [exitPlayback, hasEnded, isPaused, isPlaying, pausePlayback, restartPlayback, resumePlayback]);

    useEffect(() => {
        return () => {
            stopAnimation();
        };
    }, [stopAnimation]);

    const trimmedText = text.trim();
    const hasScript = trimmedText.length > 0;

    if (isPlaying) {
        const translateY = viewportHeightRef.current - scrollOffsetPx;
        const isDarkTheme = theme === "dark";
        const alignOrder: TextAlignMode[] = ["left", "center", "right"];
        const iconColor = isDarkTheme ? "#f8fafc" : "#0f172a";

        return (
            <div
                style={{
                    ...styles.playbackRoot,
                    background: isDarkTheme ? "#000" : "#fff",
                    color: isDarkTheme ? "#f8fafc" : "#0f172a",
                }}
            >
                <div
                    className="ui-floating-panel"
                    style={{
                        ...styles.playbackControlsTop,
                        opacity: isToolbarHovered ? 1 : 0.58,
                        background: isDarkTheme ? "rgba(15, 23, 42, 0.9)" : "rgba(241, 245, 249, 0.95)",
                        border: isDarkTheme ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(15, 23, 42, 0.18)",
                    }}
                    onMouseEnter={() => setIsToolbarHovered(true)}
                    onMouseLeave={() => setIsToolbarHovered(false)}
                >
                    <div style={styles.toolbarGroup}>
                        {alignOrder.map((mode) => (
                            <button
                                className="ui-button ui-icon-button"
                                key={mode}
                                type="button"
                                aria-label={`Align ${mode}`}
                                aria-pressed={textAlign === mode}
                                onClick={() => setTextAlign(mode)}
                                style={{
                                    ...styles.alignIconButton,
                                    border: textAlign === mode
                                        ? `2px solid ${iconColor}`
                                        : isDarkTheme
                                            ? "1px solid rgba(255,255,255,0.35)"
                                            : "1px solid rgba(15, 23, 42, 0.2)",
                                }}
                            >
                                <svg width="20" height="16" viewBox="0 0 20 16" fill="none" aria-hidden="true">
                                    <line
                                        x1={mode === "left" ? 2 : mode === "center" ? 3 : 2}
                                        y1="2"
                                        x2={mode === "left" ? 18 : mode === "center" ? 17 : 18}
                                        y2="2"
                                        stroke={iconColor}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <line
                                        x1={mode === "left" ? 2 : mode === "center" ? 5 : 6}
                                        y1="8"
                                        x2={mode === "left" ? 15 : mode === "center" ? 15 : 18}
                                        y2="8"
                                        stroke={iconColor}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                    <line
                                        x1={mode === "left" ? 2 : mode === "center" ? 4 : 4}
                                        y1="14"
                                        x2={mode === "left" ? 17 : mode === "center" ? 16 : 18}
                                        y2="14"
                                        stroke={iconColor}
                                        strokeWidth="2"
                                        strokeLinecap="round"
                                    />
                                </svg>
                            </button>
                        ))}
                    </div>

                    <div style={styles.toolbarGroup}>
                        <label style={styles.toolbarGroup}>
                            <span style={styles.toolbarLabel}>Speed {speed}</span>
                            <input
                                className="ui-range"
                                type="range"
                                min={MIN_SPEED}
                                max={MAX_SPEED}
                                value={speed}
                                style={styles.toolbarSlider}
                                onChange={(event) => setSpeed(Number(event.target.value))}
                            />
                        </label>

                        <label style={styles.toolbarGroup}>
                            <span style={styles.toolbarLabel}>Size {fontSize}</span>
                            <input
                                className="ui-range"
                                type="range"
                                min={MIN_SIZE}
                                max={MAX_SIZE}
                                value={fontSize}
                                style={styles.toolbarSlider}
                                onChange={(event) => setFontSize(Number(event.target.value))}
                            />
                        </label>
                    </div>

                    <div style={styles.toolbarGroup}>
                        <button
                            className="ui-button"
                            type="button"
                            style={{
                                ...styles.controlButton,
                                background: isDarkTheme ? "rgba(15, 23, 42, 0.8)" : "rgba(248, 250, 252, 0.9)",
                                color: isDarkTheme ? "#f8fafc" : "#0f172a",
                                border: isDarkTheme ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(15, 23, 42, 0.2)",
                            }}
                            onClick={() => {
                                if (isPaused) {
                                    resumePlayback();
                                } else {
                                    pausePlayback();
                                }
                            }}
                            disabled={hasEnded}
                        >
                            {isPaused ? "Resume" : "Pause"}
                        </button>
                        <button
                            className="ui-button"
                            type="button"
                            style={{
                                ...styles.controlButton,
                                background: isDarkTheme ? "rgba(15, 23, 42, 0.8)" : "rgba(248, 250, 252, 0.9)",
                                color: isDarkTheme ? "#f8fafc" : "#0f172a",
                                border: isDarkTheme ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(15, 23, 42, 0.2)",
                            }}
                            onClick={restartPlayback}
                        >
                            Restart
                        </button>
                        <button
                            className="ui-button"
                            type="button"
                            style={{
                                ...styles.controlButton,
                                background: isDarkTheme ? "rgba(15, 23, 42, 0.8)" : "rgba(248, 250, 252, 0.9)",
                                color: isDarkTheme ? "#f8fafc" : "#0f172a",
                                border: isDarkTheme ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(15, 23, 42, 0.2)",
                            }}
                            onClick={() => void exitPlayback()}
                        >
                            Exit
                        </button>
                    </div>
                </div>

                <div ref={viewportRef} style={styles.viewport}>
                    <div
                        ref={contentRef}
                        style={{
                            ...styles.script,
                            fontSize: `${fontSize}px`,
                            transform: `translateY(${translateY}px)`,
                        }}
                    >
                        {trimmedText.split(/\n/).map((line, index) => (
                            <p key={index} style={{ ...styles.line, textAlign }}>
                                {line.length > 0 ? line : "\u00A0"}
                            </p>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <section className="ui-stack" data-gap="lg">
            <label className="ui-field" htmlFor="teleprompter-text">
                <span className="ui-label">Script</span>
                <textarea
                    className="ui-textarea ui-code-input"
                    id="teleprompter-text"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    placeholder="Paste your script here…"
                    rows={12}
                />
            </label>

            <div className="ui-grid">
                <label className="ui-field">
                    <span className="ui-label">Speed: {speed} px/s</span>
                    <input
                        className="ui-range"
                        type="range"
                        min={MIN_SPEED}
                        max={MAX_SPEED}
                        value={speed}
                        onChange={(event) => setSpeed(Number(event.target.value))}
                    />
                </label>

                <label className="ui-field">
                    <span className="ui-label">Text size: {fontSize}px</span>
                    <input
                        className="ui-range"
                        type="range"
                        min={MIN_SIZE}
                        max={MAX_SIZE}
                        value={fontSize}
                        onChange={(event) => setFontSize(Number(event.target.value))}
                    />
                </label>

                <fieldset className="ui-panel ui-stack" data-gap="sm">
                    <legend className="ui-label">Theme</legend>
                    <label className="ui-choice">
                        <input
                            type="radio"
                            name="teleprompter-theme"
                            value="dark"
                            checked={theme === "dark"}
                            onChange={() => setTheme("dark")}
                        />
                        Black background / White text
                    </label>
                    <label className="ui-choice">
                        <input
                            type="radio"
                            name="teleprompter-theme"
                            value="light"
                            checked={theme === "light"}
                            onChange={() => setTheme("light")}
                        />
                        White background / Black text
                    </label>
                </fieldset>

                <fieldset className="ui-panel ui-stack" data-gap="sm">
                    <legend className="ui-label">Alignment</legend>
                    <label className="ui-choice">
                        <input
                            type="radio"
                            name="teleprompter-align"
                            value="left"
                            checked={textAlign === "left"}
                            onChange={() => setTextAlign("left")}
                        />
                        Left
                    </label>
                    <label className="ui-choice">
                        <input
                            type="radio"
                            name="teleprompter-align"
                            value="center"
                            checked={textAlign === "center"}
                            onChange={() => setTextAlign("center")}
                        />
                        Center
                    </label>
                    <label className="ui-choice">
                        <input
                            type="radio"
                            name="teleprompter-align"
                            value="right"
                            checked={textAlign === "right"}
                            onChange={() => setTextAlign("right")}
                        />
                        Right
                    </label>
                </fieldset>
            </div>

            <button
                className="ui-button"
                data-size="lg"
                type="button"
                aria-disabled={!hasScript}
                onClick={() => {
                    if (!hasScript) return;
                    void enterPlayback();
                }}
            >
                Play
            </button>
        </section>
    );
}

const styles: Record<string, CSSProperties> = {
    playbackRoot: {
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        paddingTop: "env(safe-area-inset-top)",
    },
    playbackControlsTop: {
        position: "absolute",
        left: 0,
        right: 0,
        top: "12px",
        transform: "none",
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        justifyContent: "space-between",
        gap: "8px",
        zIndex: 3,
        padding: "10px",
        borderRadius: 0,
        transition: "opacity 0.2s ease",
        width: "100%",
        boxSizing: "border-box",
    },
    controlButton: {
        borderRadius: "6px",
        padding: "8px 12px",
        fontWeight: 600,
        cursor: "pointer",
    },
    toolbarGroup: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    toolbarLabel: {
        fontSize: "14px",
        fontWeight: 700,
        minWidth: "72px",
    },
    toolbarSlider: {
        width: "180px",
    },
    alignIconButton: {
        width: "38px",
        height: "32px",
        borderRadius: "6px",
        background: "transparent",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    viewport: {
        height: "100vh",
        overflow: "hidden",
        padding: "0 8vw",
        boxSizing: "border-box",
    },
    script: {
        width: "100%",
        lineHeight: 1.4,
        willChange: "transform",
    },
    line: {
        margin: "0 0 0.8em",
        textAlign: "left",
        fontWeight: 700,
    },
};
