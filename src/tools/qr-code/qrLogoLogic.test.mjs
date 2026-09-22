import test from "node:test";
import assert from "node:assert/strict";
import { getAlphaBounds, getLogoPlacement } from "./qrLogoLogic.mjs";

test("trim retains faint artwork and detects asymmetric transparent borders", () => {
    const pixels = new Uint8ClampedArray(8 * 6 * 4);
    pixels[(2 * 8 + 3) * 4 + 3] = 1;
    pixels[(4 * 8 + 6) * 4 + 3] = 255;
    assert.deepEqual(getAlphaBounds(pixels, 8, 6), { x: 3, y: 2, width: 4, height: 3 });
    assert.equal(getAlphaBounds(new Uint8ClampedArray(16), 2, 2), null);
    assert.deepEqual(getAlphaBounds(new Uint8ClampedArray(16).fill(255), 2, 2), { x: 0, y: 0, width: 2, height: 2 });
});

test("Fit centers the entire trimmed logo with no stretching", () => {
    const bounds = { x: 20, y: 30, width: 200, height: 100 };
    const result = getLogoPlacement(bounds, { x: 10, y: 10, size: 80 }, "fit");
    assert.equal(result.scale, 0.4);
    assert.equal(result.x + bounds.x * result.scale, 10);
    assert.equal(result.y + bounds.y * result.scale, 30);
});

test("Fill covers the frame with centered artwork for wide, tall, and square images", () => {
    const frame = { x: 10, y: 10, size: 80 };
    for (const [width, height] of [[200, 100], [100, 200], [100, 100]]) {
        const bounds = { x: 20, y: 30, width, height };
        const result = getLogoPlacement(bounds, frame, "fill");
        const left = result.x + bounds.x * result.scale;
        const top = result.y + bounds.y * result.scale;
        assert.ok(left <= frame.x && top <= frame.y);
        assert.ok(left + width * result.scale >= frame.x + frame.size);
        assert.ok(top + height * result.scale >= frame.y + frame.size);
        assert.equal(left + width * result.scale / 2, frame.x + frame.size / 2);
        assert.equal(top + height * result.scale / 2, frame.y + frame.size / 2);
    }
});
