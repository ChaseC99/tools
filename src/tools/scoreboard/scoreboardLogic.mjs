/** @typedef {0 | 1} TeamIndex */
/** @typedef {{ name: string, color: string, score: number, players: string[] }} Team */
/** @typedef {{ target: number, winByTwo: boolean, cap: number | null }} WinningRules */
/** @typedef {{ name: string, color: string, score: string, players: string }} TeamInput */
/** @typedef {{ teams: [TeamInput, TeamInput], target: string, winByTwo: boolean, cap: string }} SettingsDraft */
/**
 * @typedef {Object} ScoreboardGame
 * @property {1} version
 * @property {[Team, Team]} teams
 * @property {[TeamIndex, TeamIndex]} order
 * @property {WinningRules} rules
 * @property {boolean} hasCelebrated
 */

export const STORAGE_KEY = "tools-scoreboard-v1";
export const MAX_SCORE = Number.MAX_SAFE_INTEGER;
export const MAX_NAME_LENGTH = 40;
export const MAX_PLAYERS = 20;

export const URL_PARAMETERS = ["teamA", "teamB", "colorA", "colorB", "scoreA", "scoreB", "playerA", "playerB", "target", "winBy2", "cap", "swapped"];

/** @returns {ScoreboardGame} */
export function createGame() {
    return {
        version: 1,
        teams: [
            { name: "Team A", color: "#3984e8", score: 0, players: [] },
            { name: "Team B", color: "#ed9436", score: 0, players: [] },
        ],
        order: [0, 1],
        rules: { target: 25, winByTwo: true, cap: null },
        hasCelebrated: false,
    };
}

/** @param {ScoreboardGame} game @returns {TeamIndex | null} */
export function getWinner(game) {
    for (const index of /** @type {const} */ ([0, 1])) {
        const score = game.teams[index].score;
        const lead = score - game.teams[1 - index].score;
        if (lead <= 0) continue;
        if (game.rules.cap !== null && score >= game.rules.cap) return index;
        if (score >= game.rules.target && lead >= (game.rules.winByTwo ? 2 : 1)) return index;
    }
    return null;
}

/**
 * @param {ScoreboardGame} game
 * @param {TeamIndex} team
 * @param {1 | -1} delta
 * @returns {{ game: ScoreboardGame, celebrate: TeamIndex | null }}
 */
export function changeScore(game, team, delta) {
    const score = Math.max(0, Math.min(MAX_SCORE, game.teams[team].score + delta));
    if (score === game.teams[team].score) return { game, celebrate: null };

    const next = {
        ...game,
        teams: /** @type {[Team, Team]} */ (game.teams.map((value, index) => index === team ? { ...value, score } : value)),
    };
    const winner = getWinner(next);
    // Correcting the winning point can re-arm the result. Continuing a finished
    // game never reopens the dialog, even at a later two-point lead or the cap.
    if (delta === -1 && winner === null) next.hasCelebrated = false;
    const celebrate = delta === 1 && !next.hasCelebrated && getWinner(game) === null ? winner : null;
    if (celebrate !== null) next.hasCelebrated = true;
    return { game: next, celebrate };
}

/** @param {ScoreboardGame} game */
export function finalScoreText(game) {
    const teams = game.order.map(index => game.teams[index]);
    const [left, right] = teams;
    const score = `${left.name} ${left.score} - ${right.score} ${right.name}`;
    const rosters = teams.filter(team => team.players.length > 0)
        .map(team => `${team.name}: ${team.players.join(", ")}`).join("\n");
    return rosters ? `${score}\n\n${rosters}` : score;
}

/** @param {ScoreboardGame} game @returns {ScoreboardGame} */
export function swapSides(game) {
    return { ...game, order: [game.order[1], game.order[0]] };
}

/**
 * @param {ScoreboardGame} game
 * @param {[Team, Team]} teams
 * @param {WinningRules} rules
 * @returns {ScoreboardGame}
 */
export function applySettings(game, teams, rules) {
    const next = { ...game, teams, rules };
    const scoringChanged = teams.some((team, index) => team.score !== game.teams[index].score)
        || rules.target !== game.rules.target || rules.winByTwo !== game.rules.winByTwo || rules.cap !== game.rules.cap;
    // Loading or editing a completed score never launches confetti.
    if (scoringChanged) next.hasCelebrated = getWinner(next) !== null;
    return next;
}

/** @param {ScoreboardGame} game @returns {SettingsDraft} */
export function settingsDraft(game) {
    return {
        teams: /** @type {[TeamInput, TeamInput]} */ (game.teams.map(team => ({ ...team, score: String(team.score), players: team.players.join("\n") }))),
        target: String(game.rules.target),
        winByTwo: game.rules.winByTwo,
        cap: game.rules.cap === null ? "" : String(game.rules.cap),
    };
}

/**
 * Apply valid fields immediately while retaining the user's incomplete input
 * separately. Invalid numbers never silently turn into zero or erase a match.
 * @param {ScoreboardGame} game
 * @param {SettingsDraft} draft
 * @returns {{ game: ScoreboardGame, errors: Record<string, string> }}
 */
export function applySettingsDraft(game, draft) {
    /** @type {Record<string, string>} */
    const errors = {};
    const teams = /** @type {[Team, Team]} */ (draft.teams.map((team, index) => {
        const score = parseScore(team.score);
        const players = parsePlayers(team.players);
        if (score === null) errors[`score${index}`] = "Enter a whole number of 0 or more.";
        if (players === null) errors[`players${index}`] = `Use up to ${MAX_PLAYERS} players, with ${MAX_NAME_LENGTH} characters per name.`;
        return {
            name: team.name.trim().slice(0, MAX_NAME_LENGTH) || `Team ${index === 0 ? "A" : "B"}`,
            color: /^#[0-9a-f]{6}$/i.test(team.color) ? team.color : game.teams[index].color,
            score: score ?? game.teams[index].score,
            players: players ?? game.teams[index].players,
        };
    }));
    const target = parseScore(draft.target);
    const cap = draft.cap === "" ? null : parseScore(draft.cap);
    if (target === null || target < 1) errors.target = "Enter a winning score of 1 or more.";
    if (draft.cap !== "" && (cap === null || cap < (target || game.rules.target))) {
        errors.cap = `Enter a cap of ${target || game.rules.target} or more, or leave it blank.`;
    }
    const rules = { ...game.rules, winByTwo: draft.winByTwo };
    if (!errors.target && !errors.cap) {
        rules.target = target;
        rules.cap = cap;
    }
    return { game: applySettings(game, teams, rules), errors };
}

/** @param {unknown} value */
function isScore(value) {
    return Number.isSafeInteger(value) && Number(value) >= 0;
}

/** @param {string} text @returns {number | null} */
export function parseScore(text) {
    if (!/^\d+$/.test(text)) return null;
    const value = Number(text);
    return isScore(value) ? value : null;
}

/** @param {string} text @returns {string[] | null} */
export function parsePlayers(text) {
    const players = text.split(/\r?\n/).map(name => name.trim()).filter(Boolean);
    return validPlayers(players) ? players : null;
}

/** @param {unknown} players @returns {players is string[]} */
function validPlayers(players) {
    return Array.isArray(players) && players.length <= MAX_PLAYERS
        && players.every(name => typeof name === "string" && name.trim().length > 0 && name.length <= MAX_NAME_LENGTH);
}

/** @param {string | null} serialized @returns {ScoreboardGame} */
export function restoreGame(serialized) {
    if (!serialized) return createGame();
    try {
        const value = JSON.parse(serialized);
        if (value?.version !== 1
            || !Array.isArray(value.teams) || value.teams.length !== 2
            || !value.teams.every(team => team && typeof team.name === "string" && team.name.trim().length > 0
                && team.name.length <= MAX_NAME_LENGTH && /^#[0-9a-f]{6}$/i.test(team.color)
                && isScore(team.score) && (team.players === undefined || validPlayers(team.players)))
            || !Array.isArray(value.order) || value.order.length !== 2 || !value.order.includes(0) || !value.order.includes(1)
            || !value.rules || !isScore(value.rules.target) || value.rules.target < 1
            || typeof value.rules.winByTwo !== "boolean"
            || (value.rules.cap !== null && (!isScore(value.rules.cap) || value.rules.cap < value.rules.target))) {
            return createGame();
        }
        const game = createGame();
        game.teams = value.teams.map(team => ({ name: team.name.trim(), color: team.color, score: team.score, players: (team.players ?? []).map(name => name.trim()) }));
        game.order = [...value.order];
        game.rules = { target: value.rules.target, winByTwo: value.rules.winByTwo, cap: value.rules.cap };
        game.hasCelebrated = typeof value.hasCelebrated === "boolean" ? value.hasCelebrated : getWinner(game) !== null;
        return game;
    } catch {
        return createGame();
    }
}

/**
 * A configured link starts from defaults, independent of the recipient's last
 * match. With no recognized options, keep the locally saved game instead.
 * @param {string} search
 * @param {ScoreboardGame} fallback
 * @returns {ScoreboardGame}
 */
export function gameFromSearch(search, fallback = createGame()) {
    const params = new URLSearchParams(search);
    if (!URL_PARAMETERS.some(name => params.has(name))) return fallback;
    const game = createGame();
    for (const [index, suffix] of /** @type {const} */ ([[0, "A"], [1, "B"]])) {
        const name = params.get(`team${suffix}`)?.trim();
        if (name && name.length <= MAX_NAME_LENGTH) game.teams[index].name = name;
        const color = params.get(`color${suffix}`)?.replace(/^#/, "");
        if (color && /^[0-9a-f]{6}$/i.test(color)) game.teams[index].color = `#${color}`;
        const score = parseScore(params.get(`score${suffix}`) ?? "");
        if (score !== null) game.teams[index].score = score;
        const players = params.getAll(`player${suffix}`).map(player => player.trim()).filter(Boolean);
        if (validPlayers(players)) game.teams[index].players = players;
    }
    const target = parseScore(params.get("target") ?? "");
    if (target !== null && target > 0) game.rules.target = target;
    const winBy2 = params.get("winBy2");
    if (winBy2 === "false" || winBy2 === "0") game.rules.winByTwo = false;
    const cap = parseScore(params.get("cap") ?? "");
    if (cap !== null && cap >= game.rules.target) game.rules.cap = cap;
    if (["true", "1"].includes(params.get("swapped"))) game.order = [1, 0];
    game.hasCelebrated = getWinner(game) !== null
        || (fallback.hasCelebrated && gameToSearch(game) === gameToSearch(fallback));
    return game;
}

/** @param {ScoreboardGame} game @param {string} search @returns {string} */
export function gameToSearch(game, search = "") {
    const params = new URLSearchParams(search);
    URL_PARAMETERS.forEach(name => params.delete(name));
    for (const [index, suffix] of /** @type {const} */ ([[0, "A"], [1, "B"]])) {
        const team = game.teams[index];
        params.set(`team${suffix}`, team.name);
        params.set(`color${suffix}`, team.color.slice(1));
        params.set(`score${suffix}`, String(team.score));
        team.players.forEach(player => params.append(`player${suffix}`, player));
    }
    params.set("target", String(game.rules.target));
    params.set("winBy2", String(game.rules.winByTwo));
    params.set("cap", game.rules.cap === null ? "none" : String(game.rules.cap));
    params.set("swapped", String(game.order[0] === 1));
    return params.toString();
}
