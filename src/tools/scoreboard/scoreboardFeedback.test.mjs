import test from "node:test";
import assert from "node:assert/strict";
import { hapticFeedback, shareFinalScore } from "./scoreboardFeedback.mjs";

test("haptics use short point/win patterns and tolerate unsupported or blocked vibration", () => {
    const patterns = [];
    const browser = { vibrate: pattern => { patterns.push(pattern); return true; } };
    hapticFeedback(browser);
    hapticFeedback(browser, true);
    assert.deepEqual(patterns, [10, [20, 40, 20]]);
    assert.doesNotThrow(() => hapticFeedback({}));
    assert.doesNotThrow(() => hapticFeedback({ vibrate() { throw new Error("Blocked"); } }));
});

test("native sharing receives only the score text, without a separate title or attachments", async () => {
    const text = "30 : Blue\n29 : Gold\n\nhttps://tools.example/scoreboard?teamA=Blue&scoreA=30&teamB=Gold&scoreB=29&cap=30#scoreboard";
    let payload;
    const result = shareFinalScore({ share: async data => { payload = data; }, clipboard: { writeText: async () => assert.fail("Unexpected clipboard write") } }, text);
    assert.deepEqual(payload, { text });
    assert.equal(await result, "shared");
});

test("canceling the native sheet never falls back to copying", async () => {
    assert.equal(await shareFinalScore({ share: async () => { throw { name: "AbortError" }; }, clipboard: { writeText: async () => assert.fail("Unexpected clipboard write") } }, "Score"), "cancelled");
});

test("unsupported or blocked sharing copies the same score, with a manual fallback", async () => {
    let copied;
    const clipboard = { writeText: async text => { copied = text; } };
    assert.equal(await shareFinalScore({ clipboard }, "Final score: 30 – 29"), "copied");
    assert.equal(copied, "Final score: 30 – 29");
    assert.equal(await shareFinalScore({ share: async () => { throw { name: "NotAllowedError" }; }, clipboard }, "Final score: 25 – 24"), "copied");
    assert.equal(copied, "Final score: 25 – 24");
    assert.equal(await shareFinalScore({}, "Score"), "manual");
    assert.equal(await shareFinalScore({ clipboard: { writeText: async () => { throw new Error("Blocked"); } } }, "Score"), "manual");
});
