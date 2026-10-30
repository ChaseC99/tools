import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { applySettings, applySettingsDraft, changeScore, createGame, finalScoreText, gameFromSearch, gameToSearch, getWinner, MAX_NAME_LENGTH, MAX_PLAYERS, MAX_SCORE, restoreGame, settingsDraft, STORAGE_KEY, swapSides } from "./scoreboardLogic.mjs";
import { hapticFeedback, shareFinalScore } from "./scoreboardFeedback.mjs";
import type { ScoreboardGame, SettingsDraft, Team, TeamIndex, TeamInput } from "./scoreboardLogic.mjs";
import "./Scoreboard.css";

type Celebration = { id: number; name: string; colors: string[] };
type FinalResult = { game: ScoreboardGame; winner: TeamIndex };

function Icon({ name }: { name: "settings" | "swap" | "close" | "browse" | "link" | "chevron" | "share" }) {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {name === "settings" && <><path d="M3 7h5m4 0h9M3 17h9m4 0h5" /><circle cx="10" cy="7" r="2" /><circle cx="14" cy="17" r="2" /></>}
            {name === "swap" && <path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4" />}
            {name === "close" && <path d="m6 6 12 12M18 6 6 18" />}
            {name === "browse" && <path d="M7 17 17 7M7 7h10v10" />}
            {name === "chevron" && <path d="m9 5 7 7-7 7" />}
            {name === "share" && <path d="M12 16V3m-4 4 4-4 4 4M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8" />}
            {name === "link" && <path d="m10 13 4-4m-6 7-1 1a4 4 0 0 1-6-6l4-4a4 4 0 0 1 6 0m2 1 1-1a4 4 0 0 1 6 6l-4 4a4 4 0 0 1-6 0" />}
        </svg>
    );
}

function PlayerList({ value, teamNumber, onChange }: { value: string; teamNumber: number; onChange: (value: string) => void }) {
    const nextId = useRef(0);
    const [rows, setRows] = useState(() => value ? value.split("\n").map(name => ({ id: nextId.current++, name })) : []);
    const pendingFocus = useRef<number | null>(null);
    const inputRefs = useRef(new Map<number, HTMLInputElement>());
    const addButtonRef = useRef<HTMLButtonElement>(null);
    const players = rows.map(row => row.name.trim()).filter(Boolean);
    const initial = (name: string) => Array.from(name.trim())[0]?.toLocaleUpperCase() || "·";

    useEffect(() => {
        setRows(current => current.map(row => row.name).join("\n") === value ? current
            : value ? value.split("\n").map(name => ({ id: nextId.current++, name })) : []);
    }, [value]);

    function updateRows(next: typeof rows) {
        setRows(next);
        onChange(next.map(row => row.name).join("\n"));
    }

    function removePlayer(index: number) {
        const next = rows.filter((_, rowIndex) => rowIndex !== index);
        const focusTarget = next[Math.min(index, next.length - 1)];
        updateRows(next);
        if (focusTarget) inputRefs.current.get(focusTarget.id)?.focus();
        else addButtonRef.current?.focus();
    }

    return <details className="scoreboard-player-settings">
        <summary className="scoreboard-disclosure-row" aria-label={`Players for Team ${teamNumber}`}>
            {players.length > 0 && <span className="scoreboard-player-avatars" aria-hidden="true">{players.slice(0, 3).map((name, index) => <span className="scoreboard-player-avatar" key={index}>{initial(name)}</span>)}</span>}
            <span>{players.length ? `${players.length} ${players.length === 1 ? "player" : "players"}` : "Add players"}</span>
            <Icon name="chevron" />
        </summary>
        <div className="scoreboard-player-list">
            {rows.map((row, index) => <div className="scoreboard-player-row" key={row.id}>
                <span className="scoreboard-player-avatar" aria-hidden="true">{initial(row.name)}</span>
                <input ref={input => {
                    if (input) {
                        inputRefs.current.set(row.id, input);
                        if (pendingFocus.current === row.id) { pendingFocus.current = null; input.focus(); }
                    } else inputRefs.current.delete(row.id);
                }} className="scoreboard-inline-input" type="text" value={row.name} maxLength={MAX_NAME_LENGTH} autoComplete="off" placeholder="Player name" aria-label={`Team ${teamNumber} player ${index + 1} name`} onChange={event => updateRows(rows.map(player => player.id === row.id ? { ...player, name: event.target.value } : player))} />
                <button className="scoreboard-remove-player" type="button" aria-label={`Remove ${row.name.trim() || `player ${index + 1}`} from Team ${teamNumber}`} onClick={() => removePlayer(index)}><Icon name="close" /></button>
            </div>)}
            <button ref={addButtonRef} className="scoreboard-add-player" type="button" aria-label={`Add player to Team ${teamNumber}`} disabled={rows.length >= MAX_PLAYERS} onClick={() => {
                const id = nextId.current++;
                pendingFocus.current = id;
                updateRows([...rows, { id, name: "" }]);
            }}><span aria-hidden="true">+</span> Add player</button>
        </div>
        {rows.length >= MAX_PLAYERS && <p className="scoreboard-player-limit">Up to {MAX_PLAYERS} players per team.</p>}
    </details>;
}

function Confetti({ colors }: { colors: string[] }) {
    const [pieces] = useState(() => Array.from({ length: 48 }, (_, index) => ({
        color: colors[index % colors.length], left: `${Math.random() * 100}%`, delay: `${Math.random() * 0.4}s`,
        drift: `${Math.random() * 100 - 50}px`, spin: `${Math.random() * 720 - 360}deg`,
    })));
    return <div className="scoreboard-confetti" aria-hidden="true">
        {pieces.map((piece, index) => <span key={index} style={{ left: piece.left, backgroundColor: piece.color, animationDelay: piece.delay, "--confetti-drift": piece.drift, "--confetti-spin": piece.spin } as CSSProperties} />)}
    </div>;
}

function readSavedGame() {
    try { return restoreGame(localStorage.getItem(STORAGE_KEY)); }
    catch { return createGame(); }
}

function WinningDialog({ result, celebration, onClose }: { result: FinalResult; celebration: Celebration | null; onClose: () => void }) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const closeRef = useRef<HTMLButtonElement>(null);
    const copyRef = useRef<HTMLTextAreaElement>(null);
    const [sharing, setSharing] = useState(false);
    const [shareStatus, setShareStatus] = useState<"shared" | "cancelled" | "copied" | "manual" | null>(null);
    const id = useId();
    const text = finalScoreText(result.game, result.winner);

    useEffect(() => {
        const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        const dialog = dialogRef.current;
        dialog?.showModal();
        closeRef.current?.focus({ preventScroll: true });
        return () => { dialog?.close(); if (trigger?.isConnected) trigger.focus({ preventScroll: true }); };
    }, []);

    useEffect(() => {
        if (shareStatus === "manual") { copyRef.current?.focus(); copyRef.current?.select(); }
    }, [shareStatus]);

    async function share() {
        if (sharing) return;
        setSharing(true);
        try { setShareStatus(await shareFinalScore(navigator, text)); }
        finally { setSharing(false); }
    }

    return <dialog ref={dialogRef} className="scoreboard-win-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-final`} onCancel={onClose}>
        {celebration && <Confetti key={celebration.id} colors={celebration.colors} />}
        <button ref={closeRef} className="ui-button ui-icon-button scoreboard-win-close" data-variant="ghost" type="button" aria-label="Close final score" onClick={onClose}><Icon name="close" /></button>
        <p className="scoreboard-win-eyebrow">Win cap reached</p>
        <h2 id={`${id}-title`}>{result.game.teams[result.winner].name} wins!</h2>
        <p className="scoreboard-win-label">Final score</p>
        <div className="scoreboard-final-scores" id={`${id}-final`}>
            {result.game.order.map((teamIndex, position) => {
                const team = result.game.teams[teamIndex];
                return <div className="scoreboard-final-team" key={teamIndex} data-winner={teamIndex === result.winner} style={{ "--team-color": team.color } as CSSProperties}>
                    <span className="scoreboard-final-name"><span aria-hidden="true" />{team.name}</span>
                    <strong style={{ "--final-score-size": `${Math.min(4, 8 / Math.max(2, String(team.score).length))}rem` } as CSSProperties}>{team.score}</strong>
                    {position === 0 && <span className="scoreboard-final-divider" aria-hidden="true">–</span>}
                </div>;
            })}
        </div>
        <div className="scoreboard-win-actions">
            <button className="ui-button" type="button" onClick={share} disabled={sharing}><Icon name="share" />{sharing ? "Opening share…" : "Share score"}</button>
            <button className="ui-button" data-variant="secondary" type="button" onClick={onClose}>Continue scoring</button>
        </div>
        <p className="scoreboard-result-share-status" role="status">{shareStatus === "copied" ? "Score copied. Paste it into a message." : shareStatus === "manual" ? "Copy the score below to share it." : ""}</p>
        {(shareStatus === "copied" || shareStatus === "manual") && <label className="ui-field scoreboard-result-copy"><span className="ui-label">Score to share</span><textarea ref={copyRef} className="ui-textarea" readOnly rows={3} value={text} onFocus={event => event.currentTarget.select()} /></label>}
    </dialog>;
}

export default function Scoreboard() {
    const [game, setGame] = useState<ScoreboardGame>(createGame);
    const gameRef = useRef(game);
    const [loaded, setLoaded] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [draft, setDraft] = useState<SettingsDraft>(() => settingsDraft(createGame()));
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [celebration, setCelebration] = useState<Celebration | null>(null);
    const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
    const [scoreFeedback, setScoreFeedback] = useState<[number, number]>([0, 0]);
    const [announcement, setAnnouncement] = useState("");
    const [shareUrl, setShareUrl] = useState("");
    const [copyMessage, setCopyMessage] = useState("");
    const [confirmReset, setConfirmReset] = useState(false);
    const settingsLinkRef = useRef<HTMLAnchorElement>(null);
    const settingsDialogRef = useRef<HTMLDialogElement>(null);
    const closeSettingsRef = useRef<HTMLButtonElement>(null);
    const backdropPointerDown = useRef(false);
    const resetButtonRef = useRef<HTMLButtonElement>(null);
    const dialogRef = useRef<HTMLDialogElement>(null);
    const cancelResetRef = useRef<HTMLButtonElement>(null);
    const shareInputRef = useRef<HTMLInputElement>(null);
    const wasSettingsOpen = useRef(false);
    const lastSearch = useRef("");
    const celebrationId = useRef(0);
    const id = useId();

    function updateGame(next: ScoreboardGame) { gameRef.current = next; setGame(next); }

    useEffect(() => {
        const initial = gameFromSearch(window.location.search, readSavedGame());
        updateGame(initial);
        lastSearch.current = window.location.search;
        setDraft(settingsDraft(initial));
        setShowSettings(window.location.hash === "#settings");
        setLoaded(true);
        const onLocationChange = () => {
            if (lastSearch.current !== window.location.search) {
                updateGame(gameFromSearch(window.location.search, readSavedGame()));
                lastSearch.current = window.location.search;
            }
            setDraft(settingsDraft(gameRef.current));
            setErrors({}); setCopyMessage(""); setCelebration(null);
            setConfirmReset(false);
            setFinalResult(null);
            setShowSettings(window.location.hash === "#settings");
        };
        window.addEventListener("hashchange", onLocationChange);
        window.addEventListener("popstate", onLocationChange);
        return () => {
            window.removeEventListener("hashchange", onLocationChange);
            window.removeEventListener("popstate", onLocationChange);
        };
    }, []);

    useEffect(() => {
        if (!loaded) return;
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); }
        catch { /* Scoring remains available when storage is blocked. */ }
        const url = new URL(window.location.href);
        url.search = gameToSearch(game, url.search);
        if (url.search !== window.location.search) {
            try {
                window.history.replaceState(window.history.state, "", url);
                lastSearch.current = url.search;
            } catch { /* Copy link still works if the browser restricts URL updates. */ }
        }
        url.hash = "";
        setShareUrl(url.toString()); setCopyMessage("");
    }, [game, loaded]);

    useEffect(() => {
        if (!celebration) return;
        const timeout = window.setTimeout(() => setCelebration(null), 2600);
        return () => window.clearTimeout(timeout);
    }, [celebration]);

    useEffect(() => {
        const dialog = settingsDialogRef.current;
        if (showSettings) {
            dialog?.showModal();
            closeSettingsRef.current?.focus({ preventScroll: true });
        } else if (wasSettingsOpen.current) settingsLinkRef.current?.focus({ preventScroll: true });
        wasSettingsOpen.current = showSettings;
        return () => dialog?.close();
    }, [showSettings]);

    useEffect(() => {
        if (!confirmReset) return;
        const dialog = dialogRef.current;
        dialog?.showModal(); cancelResetRef.current?.focus();
        return () => { dialog?.close(); resetButtonRef.current?.focus(); };
    }, [confirmReset]);

    function announceScore(next: ScoreboardGame) {
        setAnnouncement(next.teams.map(team => `${team.name} ${team.score}`).join(", "));
    }

    function onScore(team: TeamIndex, delta: 1 | -1) {
        if (!loaded || showSettings || finalResult) return;
        const result = changeScore(gameRef.current, team, delta);
        if (result.game === gameRef.current) return;
        updateGame(result.game); announceScore(result.game);
        setScoreFeedback(current => current.map((count, index) => index === team ? count + 1 : count) as [number, number]);
        hapticFeedback(navigator, result.capWinner !== null);
        if (getWinner(result.game) === null) setCelebration(null);
        const winner = result.capWinner ?? result.celebrate;
        if (winner !== null) {
            const name = result.game.teams[winner].name;
            setCelebration({ id: ++celebrationId.current, name, colors: [...result.game.teams.map(value => value.color), "#ecc34d", "#ce70c8"] });
            setAnnouncement(`${name} wins! You can continue scoring.`);
        }
        if (result.capWinner !== null) setFinalResult({ game: result.game, winner: result.capWinner });
    }

    function updateDraft(next: SettingsDraft) {
        setDraft(next);
        const result = applySettingsDraft(gameRef.current, next);
        setErrors(result.errors); updateGame(result.game);
    }

    function dismissSettings() {
        window.location.hash = "scoreboard";
    }

    function updateTeam(index: TeamIndex, update: Partial<TeamInput>) {
        updateDraft({ ...draft, teams: draft.teams.map((team, teamIndex) => teamIndex === index ? { ...team, ...update } : team) as [TeamInput, TeamInput] });
    }

    function resetScores() {
        const current = gameRef.current;
        const next = applySettings(current, current.teams.map(team => ({ ...team, score: 0 })) as [Team, Team], current.rules);
        next.hasCelebrated = false;
        updateGame(next); setDraft(settingsDraft(next)); setErrors({}); setConfirmReset(false);
        setAnnouncement("Both scores reset to zero.");
    }

    async function copyLink() {
        const url = new URL(window.location.href);
        url.search = gameToSearch(gameRef.current, url.search); url.hash = "";
        try { await navigator.clipboard.writeText(url.toString()); setCopyMessage("Link copied."); }
        catch { shareInputRef.current?.focus(); shareInputRef.current?.select(); setCopyMessage("Select and copy the link below."); }
    }

    return (
        <section className="scoreboard" aria-label="Scoreboard">
            <div className="scoreboard-board" id="scoreboard">
                <h1 className="ui-sr-only">Scoreboard</h1>
                {game.order.map((teamIndex, position) => {
                    const team = game.teams[teamIndex];
                    const digits = String(team.score).length;
                    return <div className="scoreboard-team" key={teamIndex} data-position={position} style={{ "--team-color": team.color } as CSSProperties}>
                        {scoreFeedback[teamIndex] > 0 && <span key={`feedback-${scoreFeedback[teamIndex]}`} className="scoreboard-point-feedback" aria-hidden="true" />}
                        <button className="scoreboard-add" type="button" onClick={() => onScore(teamIndex, 1)} disabled={!loaded} aria-label={`${team.name}, ${team.score} points. Add one point.`} aria-describedby={team.players.length ? `${id}-roster-${teamIndex}` : undefined}>
                            <span className="scoreboard-team-heading"><span className="scoreboard-name">{team.name}</span>{game.teams.some(value => value.players.length > 0) && <span id={`${id}-roster-${teamIndex}`} className="scoreboard-players" aria-hidden={team.players.length === 0 || undefined} title={team.players.join(", ")}>{team.players.join(" · ")}</span>}</span>
                            <span key={`score-${scoreFeedback[teamIndex]}`} className="scoreboard-score" data-feedback={scoreFeedback[teamIndex] > 0 || undefined} style={{ "--score-width": `${Math.min(66, 135 / Math.max(2, digits))}cqw` } as CSSProperties}>{team.score}</span>
                        </button>
                        <button className="scoreboard-minus" type="button" disabled={!loaded || team.score === 0} onClick={() => onScore(teamIndex, -1)} aria-label={`Subtract one point from ${team.name}`}><span aria-hidden="true">−</span></button>
                    </div>;
                })}
                <div className="scoreboard-toolbar" role="group" aria-label="Scoreboard controls">
                    <button className="ui-button scoreboard-swap" data-variant="ghost" type="button" aria-label="Swap sides" disabled={!loaded} onClick={() => {
                        const next = swapSides(gameRef.current); updateGame(next);
                        setAnnouncement(`Sides swapped. ${next.teams[next.order[0]].name} is on the left.`);
                    }}><Icon name="swap" /><span className="scoreboard-swap-label">Swap sides</span></button>
                    <a ref={settingsLinkRef} href="#settings" className="ui-button ui-icon-button scoreboard-settings-button" data-variant="ghost" aria-label="Open scoreboard settings"><Icon name="settings" /></a>
                </div>
            </div>

            {showSettings && <dialog
                ref={settingsDialogRef}
                className="scoreboard-settings-sheet"
                aria-labelledby={`${id}-settings`}
                onCancel={event => { event.preventDefault(); dismissSettings(); }}
                onPointerDown={event => { backdropPointerDown.current = event.target === event.currentTarget; }}
                onClick={event => { if (event.target === event.currentTarget && backdropPointerDown.current) dismissSettings(); }}
            >
                <div className="scoreboard-settings">
                    <header className="scoreboard-settings-heading">
                        <h2 id={`${id}-settings`}>Settings</h2>
                        <button ref={closeSettingsRef} className="ui-button ui-icon-button scoreboard-settings-close" data-variant="ghost" type="button" aria-label="Close settings" onClick={dismissSettings}><Icon name="close" /></button>
                    </header>
                    <div className="scoreboard-settings-scroll">
                        <div className="scoreboard-settings-body">
                            <fieldset className="scoreboard-fieldset">
                                <legend>Teams</legend>
                                <div className="scoreboard-settings-card">
                                    {draft.teams.map((team, index) => <div className="scoreboard-team-editor" key={index}>
                                        <div className="scoreboard-team-fields">
                                            <input className="ui-color-input" type="color" value={team.color} onInput={event => updateTeam(index as TeamIndex, { color: event.currentTarget.value })} onChange={event => updateTeam(index as TeamIndex, { color: event.target.value })} aria-label={`Team ${index + 1} color`} />
                                            <input className="scoreboard-inline-input scoreboard-team-name-input" type="text" value={team.name} maxLength={MAX_NAME_LENGTH} placeholder={`Team ${index === 0 ? "A" : "B"}`} autoComplete="off" onChange={event => updateTeam(index as TeamIndex, { name: event.target.value })} aria-label={`Team ${index + 1} name`} />
                                            <input className="ui-input scoreboard-number-input" type="number" value={team.score} min={0} max={MAX_SCORE} step={1} inputMode="numeric" onChange={event => updateTeam(index as TeamIndex, { score: event.target.value })} aria-label={`Team ${index + 1} score`} aria-invalid={!!errors[`score${index}`]} aria-describedby={errors[`score${index}`] ? `${id}-score-${index}-error` : undefined} />
                                        </div>
                                        {errors[`score${index}`] && <p className="scoreboard-field-error" id={`${id}-score-${index}-error`} role="alert">{errors[`score${index}`]}</p>}
                                        <PlayerList value={team.players} teamNumber={index + 1} onChange={players => updateTeam(index as TeamIndex, { players })} />
                                        {errors[`players${index}`] && <p className="scoreboard-field-error" role="alert">{errors[`players${index}`]}</p>}
                                    </div>)}
                                    <div className="scoreboard-reset-row"><button ref={resetButtonRef} className="scoreboard-reset-button" type="button" onClick={() => setConfirmReset(true)}>Reset scores</button></div>
                                </div>
                            </fieldset>
                            <fieldset className="scoreboard-fieldset">
                                <legend>Winning rules</legend>
                                <div className="scoreboard-settings-card">
                                    <label className="scoreboard-rule"><span>Winning score</span><input className="ui-input scoreboard-number-input" type="number" value={draft.target} min={1} max={MAX_SCORE} step={1} inputMode="numeric" onChange={event => updateDraft({ ...draft, target: event.target.value })} aria-invalid={!!errors.target} aria-describedby={errors.target ? `${id}-target-error` : undefined} /></label>
                                    {errors.target && <p className="scoreboard-field-error" id={`${id}-target-error`} role="alert">{errors.target}</p>}
                                    <label className="scoreboard-rule"><span>Win by 2<span className="scoreboard-rule-help">Need a two-point lead</span></span><span className="ui-switch"><input type="checkbox" role="switch" checked={draft.winByTwo} onChange={event => updateDraft({ ...draft, winByTwo: event.target.checked })} /><span className="ui-switch-track" aria-hidden="true" /></span></label>
                                    <label className="scoreboard-rule"><span>Win cap<span className="scoreboard-rule-help" id={`${id}-cap-help`}>Game over at the cap<span className="ui-sr-only">. Leave blank for no cap.</span></span></span><input className="ui-input scoreboard-number-input" type="number" value={draft.cap} min={Math.max(1, Number(draft.target) || 1)} max={MAX_SCORE} step={1} inputMode="numeric" placeholder="None" title="Leave blank for no cap" aria-invalid={!!errors.cap} aria-describedby={`${id}-cap-help${errors.cap ? ` ${id}-cap-error` : ""}`} onChange={event => updateDraft({ ...draft, cap: event.target.value })} /></label>
                                    {errors.cap && <p className="scoreboard-field-error" id={`${id}-cap-error`} role="alert">{errors.cap}</p>}
                                </div>
                            </fieldset>
                        </div>
                        <section className="scoreboard-settings-group" aria-labelledby={`${id}-share`}>
                            <h3 id={`${id}-share`}>Share</h3>
                            <details className="scoreboard-settings-card scoreboard-url-help">
                                <summary className="scoreboard-disclosure-row"><span>Configure with URL</span><Icon name="chevron" /></summary>
                                <div className="scoreboard-disclosure-content">
                                    <p>Every setting can be set in the link. The address updates as you make changes or score points. Copy a link to open this exact setup, including the current scores.</p>
                                    <button className="ui-button" data-variant="secondary" type="button" onClick={copyLink}><Icon name="link" />Copy link</button>
                                    <p className="scoreboard-copy-status" role="status">{copyMessage}</p>
                                    <label className="ui-field"><span className="ui-label">Current scoreboard link</span><input ref={shareInputRef} className="ui-input" readOnly value={shareUrl} onFocus={event => event.currentTarget.select()} /></label>
                                    <dl className="scoreboard-url-options">
                                        <div><dt><code>teamA</code>, <code>teamB</code></dt><dd>Team names.</dd></div>
                                        <div><dt><code>colorA</code>, <code>colorB</code></dt><dd>Six-digit hex colors without the #, like <code>3984e8</code>.</dd></div>
                                        <div><dt><code>scoreA</code>, <code>scoreB</code></dt><dd>Starting scores, using whole numbers of 0 or more.</dd></div>
                                        <div><dt><code>playerA</code>, <code>playerB</code></dt><dd>Repeat for each player: <code>playerA=Alex&amp;playerA=Sam</code>.</dd></div>
                                        <div><dt><code>target</code></dt><dd>Winning score. Defaults to 25.</dd></div>
                                        <div><dt><code>winBy2</code></dt><dd><code>true</code> or <code>false</code>. Defaults to true.</dd></div>
                                        <div><dt><code>cap</code></dt><dd>A score at least as high as the target, or <code>none</code>. Defaults to none.</dd></div>
                                        <div><dt><code>swapped</code></dt><dd><code>true</code> puts Team B on the left. Defaults to false.</dd></div>
                                    </dl>
                                    <p>Example</p><code className="scoreboard-url-example">/scoreboard?teamA=Blue&amp;teamB=Gold&amp;playerA=Alex&amp;playerA=Sam&amp;target=21&amp;winBy2=true&amp;cap=25</code>
                                    <p>Configured links use defaults for omitted or invalid options. Without URL options, your last saved match is restored.</p>
                                </div>
                            </details>
                        </section>
                        <section className="scoreboard-settings-group" aria-labelledby={`${id}-more`}>
                            <h3 id={`${id}-more`}>More</h3>
                            <details className="scoreboard-settings-card scoreboard-more-tools">
                                <summary className="scoreboard-disclosure-row"><span>See more tools</span><Icon name="chevron" /></summary>
                                <div className="scoreboard-disclosure-content">
                                    <p>Leave the scoreboard to explore the other tools. Your match stays saved.</p>
                                    <a href="/" className="scoreboard-all-tools">Browse all tools<Icon name="browse" /></a>
                                </div>
                            </details>
                        </section>
                    </div>
                </div>
            </dialog>}

            <dialog ref={dialogRef} className="scoreboard-reset-dialog" aria-labelledby={`${id}-reset-title`} aria-describedby={`${id}-reset-description`} onCancel={() => setConfirmReset(false)}>
                <h2 id={`${id}-reset-title`}>Reset both scores?</h2><p id={`${id}-reset-description`}>Both scores will return to 0.</p>
                <div className="scoreboard-reset-actions"><button ref={cancelResetRef} className="ui-button" data-variant="secondary" type="button" onClick={() => setConfirmReset(false)}>Keep scores</button><button className="ui-button" data-variant="danger" type="button" onClick={resetScores}>Reset scores</button></div>
            </dialog>
            {finalResult && <WinningDialog result={finalResult} celebration={celebration} onClose={() => { setFinalResult(null); setCelebration(null); }} />}
            {celebration && !finalResult && <><Confetti key={celebration.id} colors={celebration.colors} /><div className="scoreboard-celebration" aria-hidden="true"><span>{celebration.name} wins!</span></div></>}
            <span className="ui-sr-only" role="status" aria-live="polite" aria-atomic="true">{announcement}</span>
            <noscript>Enable JavaScript to keep score.</noscript>
        </section>
    );
}
