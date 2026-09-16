import { analyzeMedia } from "../src/analyzer.js";
async function main() {
    const info1 = await analyzeMedia("samples/sample_match.mp4");
    console.log("✅ MATCH sample:", info1);

    const info2 = await analyzeMedia("samples/sample_remux.mkv");
    console.log("✅ REMUX sample:", info2);

    const info3 = await analyzeMedia("samples/sample_transcode.avi");
    console.log("✅ TRANSCODE sample:", info3);

}
main().catch((err) => console.error(err));
