import test from "node:test";
import assert from "node:assert/strict";
import { applySettings, applySettingsDraft, changeScore, createGame, finalScoreText, gameFromSearch, gameToSearch, getWinner, parsePlayers, restoreGame, settingsDraft, swapSides } from "./scoreboardLogic.mjs";

function match(scores, rules = {}) {
    const game = createGame();
    game.teams.forEach((team, index) => { team.score = scores[index]; });
    game.rules = { ...game.rules, ...rules };
    return game;
}

test("winning score, two-point lead, optional cap, and ties", () => {
    for (const [scores, rules, expected] of [
        [[24, 0], {}, null], [[25, 23], {}, 0], [[23, 25], {}, 1],
        [[25, 24], {}, null], [[26, 24], {}, 0], [[30, 29], {}, null],
        [[25, 24], { winByTwo: false }, 0], [[25, 25], { winByTwo: false }, null],
        [[30, 29], { cap: 30 }, 0], [[29, 30], { cap: 30 }, 1],
        [[29, 29], { cap: 30 }, null], [[30, 30], { cap: 30 }, null],
        [[25, 24], { cap: 25 }, 0],
    ]) {
        assert.equal(getWinner(match(scores, rules)), expected, JSON.stringify({ scores, rules }));
    }
});

test("scoring is independent, immutable, and never goes below zero", () => {
    const game = createGame();
    assert.equal(changeScore(game, 0, -1).game, game);
    const next = changeScore(game, 1, 1).game;
    assert.deepEqual(next.teams.map(team => team.score), [0, 1]);
    assert.deepEqual(game.teams.map(team => team.score), [0, 0]);
    assert.equal(changeScore(next, 1, -1).game.teams[1].score, 0);
});

test("celebrates once and permits continued scoring beyond the target and cap", () => {
    const win = changeScore(match([24, 23]), 0, 1);
    assert.equal(win.celebrate, 0);
    let continued = changeScore(win.game, 1, 1);
    assert.equal(continued.celebrate, null);
    continued = changeScore(continued.game, 0, 1);
    assert.equal(continued.celebrate, null);
    assert.deepEqual(continued.game.teams.map(team => team.score), [26, 24]);

    const capWin = changeScore(match([29, 29], { cap: 30 }), 1, 1);
    assert.equal(capWin.celebrate, 1);
    const beyondCap = changeScore(capWin.game, 1, 1);
    assert.equal(beyondCap.game.teams[1].score, 31);
    assert.equal(beyondCap.celebrate, null);
});

test("subtracting an accidental winning point allows the corrected win to celebrate", () => {
    const win = changeScore(match([24, 23]), 0, 1);
    const corrected = changeScore(win.game, 0, -1);
    assert.equal(corrected.celebrate, null);
    assert.equal(corrected.game.hasCelebrated, false);
    assert.equal(changeScore(corrected.game, 0, 1).celebrate, 0);
});

test("all winning rules emit a result on the winning point", () => {
    for (const [scores, rules, team, expected] of [
        [[24, 23], {}, 0, 0],
        [[24, 24], { winByTwo: false }, 1, 1],
        [[24, 24], {}, 0, null],
        [[25, 24], {}, 0, 0],
        [[29, 29], { cap: 30 }, 1, 1],
        [[24, 24], { cap: 25 }, 0, 0],
    ]) {
        const result = changeScore(match(scores, rules), team, 1);
        assert.equal(result.celebrate, expected, JSON.stringify({ scores, rules, team }));
    }
});

test("continuing a won match does not emit a second result at the cap", () => {
    let game = changeScore(match([24, 23], { cap: 30 }), 0, 1).game;
    for (let score = 26; score <= 31; score++) {
        const result = changeScore(game, 0, 1);
        assert.equal(result.celebrate, null);
        assert.equal(result.game.teams[0].score, score);
        game = result.game;
    }
});

test("correcting a cap-winning point allows the corrected win to show again", () => {
    const capped = changeScore(match([29, 29], { cap: 30 }), 1, 1);
    assert.equal(capped.celebrate, 1);
    const corrected = changeScore(capped.game, 1, -1);
    assert.equal(corrected.celebrate, null);
    assert.equal(corrected.game.hasCelebrated, false);
    assert.equal(changeScore(corrected.game, 1, 1).celebrate, 1);
});

test("shared final scores include rosters and retain team identities after swapping sides", () => {
    const game = match([30, 29], { cap: 30 });
    game.teams[0].name = "Blue & Gold";
    game.teams[0].players = ["Chase", "Rachel"];
    game.teams[1].name = "Away";
    game.teams[1].players = ["Connor", "Alex"];
    assert.equal(finalScoreText(game), "Blue & Gold 30 - 29 Away\n\nBlue & Gold: Chase, Rachel\nAway: Connor, Alex");
    assert.equal(finalScoreText(swapSides(game)), "Away 29 - 30 Blue & Gold\n\nAway: Connor, Alex\nBlue & Gold: Chase, Rachel");
});

test("shared scores omit empty rosters and unnecessary blank lines", () => {
    const game = match([25, 23]);
    assert.equal(finalScoreText(game), "Team A 25 - 23 Team B");
    game.teams[1].players = ["Sam"];
    assert.equal(finalScoreText(game), "Team A 25 - 23 Team B\n\nTeam B: Sam");
});

test("swapping moves the display positions without changing team identity or winning rules", () => {
    const game = match([12, 9], { target: 21, cap: 25 });
    const swapped = swapSides(game);
    assert.deepEqual(swapped.order, [1, 0]);
    assert.equal(swapped.teams, game.teams);
    assert.equal(swapped.rules, game.rules);
    assert.equal(changeScore(swapped, swapped.order[0], 1).game.teams[1].score, 10);
    assert.deepEqual(swapSides(swapped), game);
});

test("settings can reset or correct scores without replaying wins for cosmetic edits", () => {
    const won = changeScore(match([24, 23]), 0, 1).game;
    const continued = changeScore(won, 1, 1).game;
    const renamed = applySettings(continued, continued.teams.map(team => ({ ...team, name: `New ${team.name}` })), continued.rules);
    assert.equal(renamed.hasCelebrated, true);
    const reset = applySettings(renamed, renamed.teams.map(team => ({ ...team, score: 0 })), renamed.rules);
    assert.equal(reset.hasCelebrated, false);
    const editedWin = applySettings(reset, match([25, 20]).teams, reset.rules);
    assert.equal(editedWin.hasCelebrated, true);
    assert.equal(changeScore(editedWin, 0, 1).celebrate, null);
});

test("restores all match settings and ignores corrupt or unsupported saved data", () => {
    const game = swapSides(match([30, 29], { cap: 30 }));
    game.hasCelebrated = true;
    assert.deepEqual(restoreGame(JSON.stringify(game)), game);
    assert.equal(changeScore(restoreGame(JSON.stringify(game)), 0, 1).celebrate, null);
    for (const value of [null, "invalid JSON", "null", JSON.stringify({ ...game, version: 2 }),
        JSON.stringify({ ...game, order: [1, 1] }),
        JSON.stringify({ ...game, rules: { ...game.rules, cap: 20 } }),
        JSON.stringify({ ...game, teams: [{ ...game.teams[0], score: -1 }, game.teams[1]] }),
        JSON.stringify({ ...game, teams: [{ ...game.teams[0], score: 0.5 }, game.teams[1]] }),
        JSON.stringify({ ...game, teams: [{ ...game.teams[0], color: "url(example.com)" }, game.teams[1]] }),
    ]) assert.deepEqual(restoreGame(value), createGame());
});

test("URL options configure every field and repeated players survive encoding", () => {
    const game = gameFromSearch("?teamA=Blue+%26+Gold&teamB=Away&colorA=8b5cf6&colorB=%23aabbcc&scoreA=12&scoreB=9&playerA=Alex&playerA=Sam%2C+Jr.&playerB=Zo%C3%AB&target=21&winBy2=false&cap=25&swapped=true");
    assert.deepEqual(game.teams, [
        { name: "Blue & Gold", color: "#8b5cf6", score: 12, players: ["Alex", "Sam, Jr."] },
        { name: "Away", color: "#aabbcc", score: 9, players: ["Zoë"] },
    ]);
    assert.deepEqual(game.rules, { target: 21, winByTwo: false, cap: 25 });
    assert.deepEqual(game.order, [1, 0]);
    const search = gameToSearch(game, "?source=test&playerA=Old&playerA=List");
    assert.equal(new URLSearchParams(search).get("source"), "test");
    assert.deepEqual(new URLSearchParams(search).getAll("playerA"), ["Alex", "Sam, Jr."]);
    assert.deepEqual(gameFromSearch(search), game);
});

test("configured links are independent of saved games and ignore invalid options", () => {
    const saved = match([14, 17], { target: 21, cap: 25 });
    saved.teams[0].players = ["Previous player"];
    assert.equal(gameFromSearch("?unrelated=1", saved), saved);
    const configured = gameFromSearch("?teamA=New", saved);
    assert.deepEqual(configured.teams.map(team => team.score), [0, 0]);
    assert.deepEqual(configured.teams[0].players, []);
    assert.equal(configured.rules.target, 25);
    const invalid = gameFromSearch("?target=0&cap=20&scoreA=-1&scoreB=2.5&colorA=red&swapped=maybe&winBy2=maybe");
    assert.deepEqual(invalid, createGame());
    assert.equal(gameFromSearch("?cap=none").rules.cap, null);
    assert.equal(gameFromSearch("?winBy2=0").rules.winByTwo, false);
});

test("URL refresh preserves an already celebrated game that continues beyond a win", () => {
    const won = changeScore(match([24, 23]), 0, 1).game;
    const continued = changeScore(won, 1, 1).game;
    const restored = gameFromSearch(gameToSearch(continued), continued);
    assert.equal(restored.hasCelebrated, true);
    assert.equal(changeScore(restored, 0, 1).celebrate, null);
    assert.equal(gameFromSearch("?scoreA=25&scoreB=23").hasCelebrated, true);
});

test("rosters normalize blank lines, preserve duplicate names, and migrate old saves", () => {
    assert.deepEqual(parsePlayers(" Alex \r\n\nSam\nAlex\n"), ["Alex", "Sam", "Alex"]);
    assert.deepEqual(parsePlayers("\n  \n"), []);
    assert.equal(parsePlayers("x".repeat(41)), null);
    assert.equal(parsePlayers(Array(21).fill("Player").join("\n")), null);
    const old = createGame();
    old.teams.forEach(team => { delete team.players; });
    assert.deepEqual(restoreGame(JSON.stringify(old)), createGame());
    const game = createGame();
    game.teams[0].players = ["Alex", "Sam"];
    assert.deepEqual(restoreGame(JSON.stringify(game)), game);
});

test("live settings apply valid fields without erasing scores during incomplete edits", () => {
    const game = match([7, 11]);
    const draft = settingsDraft(game);
    draft.teams[0] = { name: "Blue", color: "#123abc", score: "", players: "Alex\nSam" };
    const updated = applySettingsDraft(game, draft);
    assert.deepEqual(updated.game.teams[0], { name: "Blue", color: "#123abc", score: 7, players: ["Alex", "Sam"] });
    assert.ok(updated.errors.score0);
    draft.teams[0].score = "9";
    const valid = applySettingsDraft(updated.game, draft);
    assert.equal(valid.game.teams[0].score, 9);
    assert.deepEqual(valid.errors, {});
});

test("live winning rules wait for valid bounds and apply when the cap is corrected", () => {
    const game = match([10, 10], { cap: 30 });
    const draft = settingsDraft(game);
    draft.target = "31";
    draft.winByTwo = false;
    const invalid = applySettingsDraft(game, draft);
    assert.ok(invalid.errors.cap);
    assert.deepEqual(invalid.game.rules, { target: 25, cap: 30, winByTwo: false });
    draft.cap = "35";
    const fixed = applySettingsDraft(invalid.game, draft);
    assert.deepEqual(fixed.game.rules, { target: 31, cap: 35, winByTwo: false });
    assert.deepEqual(fixed.errors, {});
    draft.cap = "";
    assert.equal(applySettingsDraft(fixed.game, draft).game.rules.cap, null);
});
