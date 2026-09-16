export function makeDecision(inputInfo, targetSpec) {
    const videoCodecMatches =
        inputInfo.videoCodec?.toLowerCase() === targetSpec.videoCodec?.toLowerCase();

    const resolutionMatches =
        inputInfo.width === targetSpec.width &&
        inputInfo.height === targetSpec.height;

    const containerMatches =
        inputInfo.container?.toLowerCase() === targetSpec.container?.toLowerCase();

    const audioMatches =
        !targetSpec.audioCodec ||
        inputInfo.audioCodec?.toLowerCase() === targetSpec.audioCodec?.toLowerCase();

    const reasons = [];

    if (!videoCodecMatches) {
        reasons.push(
            `Video codec differs: ${inputInfo.videoCodec} → ${targetSpec.videoCodec}`
        );
    }

    if (!resolutionMatches) {
        reasons.push(
            `Resolution differs: ${inputInfo.width}x${inputInfo.height} → ${targetSpec.width}x${targetSpec.height}`
        );
    }

    if (!containerMatches) {
        reasons.push(
            `Container differs: ${inputInfo.container} → ${targetSpec.container}`
        );
    }

    if (!audioMatches) {
        reasons.push(
            `Audio codec differs: ${inputInfo.audioCodec} → ${targetSpec.audioCodec}`
        );
    }

    let action;

    // Everything already matches
    if (
        videoCodecMatches &&
        resolutionMatches &&
        containerMatches &&
        audioMatches
    ) {
        action = "SKIP";
    }

    // Video codec + resolution match, and only container differs
    else if (
        videoCodecMatches &&
        resolutionMatches &&
        !containerMatches &&
        audioMatches
    ) {
        action = "REMUX";
    }

    // Any codec/resolution/audio mismatch requires transcoding
    else {
        action = "TRANSCODE";
    }

    return {
        action,
        reason: reasons.length > 0
            ? reasons.join("; ")
            : "Input already matches target specification",
        outputExtension: targetSpec.container.toLowerCase()
    };
}

