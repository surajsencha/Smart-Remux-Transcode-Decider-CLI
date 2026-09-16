import { analyzeMedia } from "../src/analyzer.js";
import { makeDecision } from "../src/decider.js";
import { executeDecision } from "../src/executor.js";
async function test() {
    const target = { container: "mp4", videoCodec: "h264", width: 1920, height: 1080, audioCodec: "aac" };
    const inputFile = "samples/sample_transcode.avi";
    const info = await analyzeMedia(inputFile);
    const decision = makeDecision(info, target);
    console.log("Decision:", decision);
    const result = await executeDecision(inputFile, decision, "output", target)
    console.log(result);
}

test();