import { makeDecision } from "../src/decider.js";

// Test Case 1: SKIP — everything matches
const input1 = { container: "mp4", videoCodec: "h264", width: 1920, height: 1080, audioCodec: "aac" };
const target = { container: "mp4", videoCodec: "h264", width: 1920, height: 1080, audioCodec: "aac" };
const result1 = makeDecision(input1, target);
console.log("Test 1 (expect SKIP):", result1.action, result1.action === "SKIP" ? "✅" : "❌");

// Test Case 2: REMUX — only container differs
const input2 = { container: "mkv", videoCodec: "h264", width: 1920, height: 1080, audioCodec: "aac" };
const result2 = makeDecision(input2, target);
console.log("Test 2 (expect REMUX):", result2.action, result2.action === "REMUX" ? "✅" : "❌");

// Test Case 3: TRANSCODE — codec differs
const input3 = { container: "avi", videoCodec: "mpeg4", width: 720, height: 480, audioCodec: "mp3" };
const result3 = makeDecision(input3, target);
console.log("Test 3 (expect TRANSCODE):", result3.action, result3.action === "TRANSCODE" ? "✅" : "❌");

// Test Case 4: TRANSCODE — container matches but codec differs
const input4 = { container: "mp4", videoCodec: "vp9", width: 1920, height: 1080, audioCodec: "aac" };
const result4 = makeDecision(input4, target);
console.log("Test 4 (expect TRANSCODE):", result4.action, result4.action === "TRANSCODE" ? "✅" : "❌");
