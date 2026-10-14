import test from "node:test";
import assert from "node:assert/strict";
import { calculateContrast, normalizeHex } from "./contrast.mjs";

test("normalizes shorthand, mixed case, whitespace, and optional hash", () => {
    assert.equal(normalizeHex(" #aBc "), "#AABBCC");
    assert.equal(normalizeHex("12abEF"), "#12ABEF");
});

test("rejects incomplete, malformed, transparent, and non-hex colors", () => {
    for (const value of ["", "#", "12", "12345", "#gggggg", "##123", "#1234", "#12345678", "red", "rgb(0,0,0)", null]) {
        assert.equal(normalizeHex(value), null);
        assert.equal(calculateContrast(value, "#fff"), null);
        assert.equal(calculateContrast("#fff", value), null);
    }
});

test("black and white have maximum contrast and pass every check", () => {
    const result = calculateContrast("#000", "#fff");
    assert.equal(result.ratio, 21);
    assert.ok(result.checks.every((check) => check.passes));
});

test("identical colors have 1:1 contrast and fail every check", () => {
    const result = calculateContrast("#abc", "#AABBCC");
    assert.equal(result.ratio, 1);
    assert.ok(result.checks.every((check) => !check.passes));
});

test("uses sRGB luminance weights and is symmetric when colors are swapped", () => {
    assert.ok(Math.abs(calculateContrast("#f00", "#fff").ratio - 3.9984767707539985) < 1e-12);
    for (const [color, expected] of [["#00ff00", 0.7152], ["#0000ff", 0.0722], ["#0a0a0a", (10 / 255) / 12.92], ["#0b0b0b", ((11 / 255 + 0.055) / 1.055) ** 2.4]]) {
        assert.ok(Math.abs(calculateContrast(color, "#000").ratio - (expected + 0.05) / 0.05) < 1e-12);
    }
    const original = calculateContrast("#abcdef", "#123456");
    const swapped = calculateContrast("#123456", "#abcdef");
    assert.equal(original.ratio, swapped.ratio);
    assert.deepEqual(original.checks.slice(0, 5), swapped.checks.slice(0, 5));
});

test("evaluates each WCAG threshold without rounding up a failure", () => {
    assert.deepEqual(calculateContrast("#777", "#fff").checks.map((check) => check.passes), [false, false, true, false, true, true]);
    assert.deepEqual(calculateContrast("#767676", "#fff").checks.map((check) => check.passes), [true, false, true, true, true, true]);
    const nearThreshold = calculateContrast("#765cf9", "#fff");
    assert.equal(nearThreshold.ratio.toFixed(2), "4.50");
    assert.ok(nearThreshold.ratio < 4.5);
    assert.equal(nearThreshold.checks[0].passes, false);
    assert.equal(nearThreshold.checks.at(-1).passes, true);
});

test("QR recommendation requires sufficient contrast and dark foreground on light background", () => {
    const qrCheck = (foreground, background) => calculateContrast(foreground, background).checks.at(-1);
    assert.equal(qrCheck("#000", "#fff").passes, true);
    assert.equal(qrCheck("#fff", "#000").passes, false);
    assert.equal(qrCheck("#eee", "#fff").passes, false);
    assert.equal(qrCheck("#123456", "#abcdef").passes, true);
    assert.equal(qrCheck("#abcdef", "#123456").passes, false);
    assert.equal(qrCheck("#949494", "#fff").passes, true);
    const belowMinimum = calculateContrast("#959595", "#fff");
    assert.equal(belowMinimum.ratio.toFixed(2), "3.00");
    assert.equal(belowMinimum.checks.at(-1).passes, false);
});
