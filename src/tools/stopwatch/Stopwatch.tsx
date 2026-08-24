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
        <section className="ui-clock ui-stack" data-gap="lg" aria-label="Stopwatch">
            <output className="ui-time-display" aria-live="off">{formatTime(elapsed)}</output>

            <div className="ui-action-bar ui-action-bar--center">
                {!running ? (
                    <button className="ui-button" data-size="lg" onClick={start}>
                        {elapsed > 0 ? "Resume" : "Start"}
                    </button>
                ) : (
                    <button className="ui-button" data-size="lg" onClick={pause}>Pause</button>
                )}
                {running && (
                    <button className="ui-button" data-size="lg" data-variant="secondary" onClick={lap}>Lap</button>
                )}
                <button className="ui-button" data-size="lg" data-variant="ghost" onClick={reset}>Reset</button>
            </div>

            {laps.length > 0 && (
                <div className="ui-data-list" aria-label="Laps">
                    <div className="ui-data-row ui-data-header">
                        <span>Lap</span>
                        <span>Time</span>
                    </div>
                    {laps.map((l, i) => (
                        <div key={l.id} className="ui-data-row">
                            <span>#{laps.length - i}</span>
                            <span className="ui-mono">{formatTime(l.time)}</span>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}
