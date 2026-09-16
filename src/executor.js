import { execFile } from "child_process";
import fs from "fs";
import path from "path";

export function executeDecision(inputPath, decision, outputDir, targetSpec) {

    if (decision.action === "SKIP") {
        return {
            action: "SKIP",
            inputFile: inputPath,
            outputFile: null,
            processingTimeMs: 0,
            inputSizeBytes: fs.statSync(inputPath).size,
            outputSizeBytes: null,
            sizeDeltaPercent: 0
        };
    }

    if (decision.action === "REMUX") {
        const baseName = path.basename(inputPath, path.extname(inputPath));
        const filename = `${baseName}_${Date.now()}.${decision.outputExtension}`;
        const outputPath = path.join(outputDir, filename);

        return runFFmpeg([
            "-i", inputPath,
            "-c", "copy",
            "-y", outputPath
        ], decision.action);
    }

    if (decision.action === "TRANSCODE") {
        const baseName = path.basename(inputPath, path.extname(inputPath));
        const filename = `${baseName}_${Date.now()}.${decision.outputExtension}`;
        const outputPath = path.join(outputDir, filename);

        return runFFmpeg([
            "-i", inputPath,
            "-c:v", "libx264",
            "-preset", "medium",
            "-crf", "23",
            "-s", `${targetSpec.width}x${targetSpec.height}`,
            "-c:a", "aac",
            "-b:a", "128k",
            "-y",
            outputPath
        ], decision.action);
    }
}

function runFFmpeg(args, action) {
    return new Promise((resolve, reject) => {
        const inputIndex = args.indexOf("-i");
        const inputPath = args[inputIndex + 1];
        const startTime = Date.now();
        const inputSize = fs.statSync(inputPath).size;
        const outputPath = args[args.length - 1];

        execFile("ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
            if (error) {
                reject(
                    new Error(`FFmpeg failed: ${stderr || error.message}`)
                );
                return;
            }

            const endTime = Date.now();
            const outputSize = fs.statSync(outputPath).size;

            const processingTimeMs = endTime - startTime;

            const sizeDeltaPercent =
                ((outputSize - inputSize) / inputSize) * 100;

            resolve({
                action,
                outputFile: outputPath,
                processingTimeMs,
                inputSizeBytes: inputSize,
                outputSizeBytes: outputSize,
                sizeDeltaPercent
            });
        });
    });
}