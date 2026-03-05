import test from "node:test";
import assert from "node:assert/strict";
import { calculateShape } from "./calculateShape.mjs";

test("calculates square area", () => {
  const result = calculateShape("square", { side: "5" });
  assert.equal(result.ok, true);
  assert.equal(result.area, 25);
});

test("calculates circle area", () => {
  const result = calculateShape("circle", { radius: "2" });
  assert.equal(result.ok, true);
  assert.ok(Math.abs(result.area - 12.566370614359172) < 1e-12);
});

test("calculates trapezoid area", () => {
  const result = calculateShape("trapezoid", { baseA: "10", baseB: "6", height: "4" });
  assert.equal(result.ok, true);
  assert.equal(result.area, 32);
});

test("returns validation error for missing field", () => {
  const result = calculateShape("rectangle", { width: "4", height: "" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Enter a value for height.");
});

test("returns validation error for non-positive input", () => {
  const result = calculateShape("triangle", { base: "0", height: "8" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Base must be a number greater than 0.");
});

test("returns validation error for unknown shape", () => {
  const result = calculateShape("hexagon", { side: "3" });
  assert.equal(result.ok, false);
  assert.equal(result.error, "Please choose a valid shape.");
});
