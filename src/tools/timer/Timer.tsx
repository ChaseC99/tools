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
        <section className="ui-clock ui-stack" data-gap="lg" aria-label="Countdown timer">
            <div className="ui-timer-ring" style={{
                width: ringSize,
                height: ringSize,
                animation: finished ? "timerFlash 0.4s ease-in-out 4" : "none",
            }}>
                <svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                    <circle cx={ringSize / 2} cy={ringSize / 2} r={ringRadius} fill="none" stroke="var(--ui-color-border)" strokeWidth="10" />
                    <circle
                        cx={ringSize / 2} cy={ringSize / 2} r={ringRadius}
                        fill="none"
                        stroke={finished ? "var(--ui-color-success)" : "var(--ui-color-text)"}
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeOffset}
                        transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                        style={{ transition: running ? "stroke-dashoffset 0.25s linear" : "none" }}
                    />
                </svg>
                <output className="ui-timer-ring__time" aria-live="off">
                    {isActive
                        ? `${pad(displayH)}:${pad(displayM)}:${pad(displayS)}`
                        : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
                    }
                </output>
            </div>

            {!isActive && (
                <div className="ui-inline ui-timer-inputs">
                    <label className="ui-field ui-timer-input">
                        <span className="ui-label">Hours</span>
                        <input
                            className="ui-input"
                            type="number" min={0} max={99}
                            value={hours} onChange={(e) => setHours(Math.max(0, +e.target.value))}
                        />
                    </label>
                    <label className="ui-field ui-timer-input">
                        <span className="ui-label">Minutes</span>
                        <input
                            className="ui-input"
                            type="number" min={0} max={59}
                            value={minutes} onChange={(e) => setMinutes(Math.min(59, Math.max(0, +e.target.value)))}
                        />
                    </label>
                    <label className="ui-field ui-timer-input">
                        <span className="ui-label">Seconds</span>
                        <input
                            className="ui-input"
                            type="number" min={0} max={59}
                            value={seconds} onChange={(e) => setSeconds(Math.min(59, Math.max(0, +e.target.value)))}
                        />
                    </label>
                </div>
            )}

            <div className="ui-action-bar ui-action-bar--center">
                {!running ? (
                    <button className="ui-button" data-size="lg" onClick={start} disabled={!isActive && inputTotal <= 0}>
                        {isActive ? "Resume" : "Start"}
                    </button>
                ) : (
                    <button className="ui-button" data-size="lg" onClick={pause}>Pause</button>
                )}
                <button className="ui-button" data-size="lg" data-variant="ghost" onClick={reset}>Reset</button>
            </div>

            <div className="ui-field ui-self-center">
                <span className="ui-label">Alarm tone</span>
                <div className="ui-segmented" role="group" aria-label="Alarm tone">
                    {TONES.map((t) => (
                        <button
                            type="button"
                            className="ui-button"
                            key={t.id}
                            onClick={() => previewTone(t.id)}
                            aria-pressed={tone === t.id}
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
        </section>
    );
}
