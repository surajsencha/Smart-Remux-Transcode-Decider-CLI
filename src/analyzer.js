import { exec, execFile } from "child_process";

function parseMediaInfo(rawData) {
    let videoStream = null;
    let audioStream = null;

    // 1. Find video and audio streams
    for (const stream of rawData.streams) {
        if (stream.codec_type === "video") {
            videoStream = stream;
        }

        if (stream.codec_type === "audio") {
            audioStream = stream;
        }
    }

    if (!videoStream) {
        throw new Error("No video stream found");
    }

    // 2. Normalize container
    const formats = rawData.format.format_name.split(",");

    let container;

    if (formats.includes("mp4")) {
        container = "mp4";
    } else if (formats.includes("matroska")) {
        container = "mkv";
    } else if (formats.includes("avi")) {
        container = "avi";
    } else if (formats.includes("webm")) {
        container = "webm";
    } else {
        container = formats[0];
    }

    // 3. Parse FPS
    const [numerator, denominator] = videoStream.r_frame_rate
        .split("/")
        .map(Number);

    const fps = Number((numerator / denominator).toFixed(2));

    // 4. Return clean object
    return {
        container,

        videoCodec: videoStream.codec_name.toLowerCase(),

        width: parseInt(videoStream.width),

        height: parseInt(videoStream.height),

        fps,

        audioCodec: audioStream
            ? audioStream.codec_name.toLowerCase()
            : null,

        duration: parseFloat(rawData.format.duration),

        fileSize: parseInt(rawData.format.size)
    };
}
export function analyzeMedia(filePath) {
    return new Promise((resolve, reject) => {
        execFile(
            "ffprobe",
            [
                "-v", "quiet",
                "-print_format", "json",
                "-show_format",
                "-show_streams",
                filePath
            ],
            (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`ffprobe failed: ${error.message}`));
                    return;
                }
                try {
                    const result = JSON.parse(stdout);
                    resolve(parseMediaInfo(result))
                } catch (err) {
                    reject(err);
                }
            }
        );
    });
}