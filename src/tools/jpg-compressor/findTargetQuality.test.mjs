import test from "node:test";
import assert from "node:assert/strict";

import { findTargetQuality } from "./findTargetQuality.mjs";

test("picks the highest quality that stays under the target size", async () => {
    const result = await findTargetQuality(
        { targetBytes: 800, minQuality: 10, maxQuality: 100 },
        async (quality) => ({ byteLength: 200 + quality * 10 }),
    );

    assert.equal(result.metTarget, true);
    assert.equal(result.quality, 60);
    assert.equal(result.byteLength, 800);
});

test("returns the smallest available result when the target cannot be met", async () => {
    const result = await findTargetQuality(
        { targetBytes: 800, minQuality: 10, maxQuality: 100 },
        async (quality) => ({ byteLength: 900 + quality * 4 }),
    );

    assert.equal(result.metTarget, false);
    assert.equal(result.quality, 10);
    assert.equal(result.byteLength, 940);
});

test("prefers the highest acceptable quality instead of the first acceptable one", async () => {
    const calls = [];
    const result = await findTargetQuality(
        { targetBytes: 805, minQuality: 10, maxQuality: 100 },
        async (quality) => {
            calls.push(quality);
            return 200 + quality * 10;
        },
    );

    assert.equal(result.metTarget, true);
    assert.equal(result.quality, 60);
    assert.ok(calls.includes(60));
    assert.ok(calls.some((quality) => quality > 60));
});
