/// <reference types="node" />
import test from "node:test";
import assert from "node:assert/strict";
import { journeyTime, stationIndex, anchors, stations, CTA } from "../src/journey.ts";
test("camera progression is bounded and monotone across entire scroll", () => {
  let previous = 0;
  for (let i = 0; i <= 10000; i++) {
    let t = journeyTime(i / 10000);
    assert.ok(t >= previous && t <= 1);
    previous = t;
  }
  assert.equal(journeyTime(0), 0);
  assert.equal(journeyTime(1), 1);
});
test("each direct jump selects the intended station during its camera dwell", () =>
  anchors.forEach((p, i) => {
    assert.equal(stationIndex(p), i);
    assert.ok(Math.abs(journeyTime(p) - i / 4) < 0.005);
  }));
test("reverse traversal returns the same camera samples", () => {
  const samples = Array.from({ length: 101 }, (_, i) => journeyTime(i / 100));
  assert.deepEqual(
    samples.slice().reverse(),
    Array.from({ length: 101 }, (_, i) => journeyTime((100 - i) / 100)),
  );
});
test("station identity and visit destination are concrete", () => {
  assert.equal(new Set(stations.map((s) => s.id)).size, 4);
  assert.equal(new URL(CTA.url).protocol, "https:");
  assert.ok(!CTA.label.includes("["));
});
