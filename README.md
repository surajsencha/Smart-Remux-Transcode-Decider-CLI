# 🎬 Smart Remux / Transcode Decider CLI

A Node.js REST API that intelligently decides whether to **skip**, **remux**, or **transcode** video files based on a target specification — then executes the conversion using FFmpeg.

## How It Works

```
Upload File → Analyze (ffprobe) → Decide (SKIP/REMUX/TRANSCODE) → Execute (ffmpeg) → Result
```

| Decision      | When                                      | Speed       | Quality Loss |
|---------------|-------------------------------------------|-------------|--------------|
| **SKIP**      | File already matches the target           | ⚡ Instant   | None         |
| **REMUX**     | Same codec & resolution, wrong container  | ⚡ Fast      | None         |
| **TRANSCODE** | Codec, resolution, or audio differs       | 🐢 Slower   | Minimal      |

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [FFmpeg](https://ffmpeg.org/) installed and available in your system PATH

Verify FFmpeg is installed:

```bash
ffmpeg -version
ffprobe -version
```

## Setup

```bash
git clone https://github.com/surajsencha/Smart-Remux-Transcode-Decider-CLI.git
cd Smart-Remux-Transcode-Decider-CLI
npm install
```

## Start the Server

```bash
npm start
```

The server runs on `http://localhost:3000`.

## API Endpoints

### 1. `POST /analyze` — Analyze a Video File

Upload a video file and get its technical details without processing it.

```bash
curl -X POST \
  -F "file=@samples/sample_remux.mkv" \
  http://localhost:3000/analyze
```

**Response:**

```json
{
  "success": true,
  "data": {
    "container": "mkv",
    "videoCodec": "h264",
    "width": 1920,
    "height": 1080,
    "fps": 30,
    "audioCodec": null,
    "duration": 5,
    "fileSize": 123055
  }
}
```

---

### 2. `POST /process` — Analyze, Decide & Execute

Upload a video file along with your target specification. The API will analyze the file, decide the best action, and execute it.

**Form Fields:**

| Field              | Type   | Default | Description                    |
|--------------------|--------|---------|--------------------------------|
| `file`             | File   | —       | **(Required)** The video file  |
| `targetContainer`  | String | `mp4`   | Target container format        |
| `targetVideoCodec` | String | `h264`  | Target video codec             |
| `targetWidth`      | Number | `1920`  | Target width in pixels         |
| `targetHeight`     | Number | `1080`  | Target height in pixels        |
| `targetAudioCodec` | String | `aac`   | Target audio codec             |

#### Example: Transcode an AVI file to MP4

```bash
curl -X POST \
  -F "file=@samples/sample_transcode.avi" \
  -F "targetContainer=mp4" \
  -F "targetVideoCodec=h264" \
  -F "targetWidth=1920" \
  -F "targetHeight=1080" \
  http://localhost:3000/process
```

**Response:**

```json
{
  "success": true,
  "data": {
    "analysis": {
      "container": "avi",
      "videoCodec": "mpeg4",
      "width": 720,
      "height": 480,
      "fps": 25,
      "audioCodec": null,
      "duration": 5.56,
      "fileSize": 410120
    },
    "decision": {
      "action": "TRANSCODE",
      "reason": "Video codec differs: mpeg4 → h264; Resolution differs: 720x480 → 1920x1080; Container differs: avi → mp4; Audio codec differs: null → aac",
      "outputExtension": "mp4"
    },
    "execution": {
      "action": "TRANSCODE",
      "outputFile": "output/sample_transcode_1789549903448.mp4",
      "processingTimeMs": 1478,
      "inputSizeBytes": 410120,
      "outputSizeBytes": 427687,
      "sizeDeltaPercent": 4.28
    }
  }
}
```

#### Example: Remux an MKV to MP4 (no re-encoding)

```bash
curl -X POST \
  -F "file=@samples/sample_remux.mkv" \
  -F "targetContainer=mp4" \
  -F "targetVideoCodec=h264" \
  -F "targetWidth=1920" \
  -F "targetHeight=1080" \
  http://localhost:3000/process
```

The decider will choose **REMUX** since only the container differs — much faster than transcoding.

#### Example: Skip (file already matches)

```bash
curl -X POST \
  -F "file=@samples/sample_match.mp4" \
  -F "targetContainer=mp4" \
  -F "targetVideoCodec=h264" \
  -F "targetWidth=1920" \
  -F "targetHeight=1080" \
  http://localhost:3000/process
```

The decider will choose **SKIP** since the file already matches the target specification.

---

### 3. `GET /jobs` — List All Jobs

```bash
curl http://localhost:3000/jobs
```

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "id": "a1b2c3d4-...",
      "status": "completed",
      "createdAt": 1789549903448,
      "result": { ... }
    }
  ]
}
```

---

### 4. `GET /jobs/:id` — Get a Specific Job

```bash
curl http://localhost:3000/jobs/a1b2c3d4-...
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "status": "completed",
    "createdAt": 1789549903448,
    "result": { ... }
  }
}
```

Returns `404` if the job is not found.

## Running Tests

```bash
# Test the analyzer (Phase 1)
npm run test:analyzer

# Test the decider (Phase 2)
npm run test:decider

# Test the executor (Phase 3)
npm run test:executor
```

## Project Structure

```
├── src/
│   ├── analyzer.js      # Phase 1: Probe files with ffprobe
│   ├── decider.js       # Phase 2: Decide SKIP / REMUX / TRANSCODE
│   ├── executor.js      # Phase 3: Run ffmpeg commands
│   ├── jobStore.js      # In-memory job tracking
│   └── server.js        # Express REST API
├── tests/
│   ├── test-analyzer.js
│   ├── test-decider.js
│   └── test-executor.js
├── samples/             # Sample video files for testing
├── uploads/             # Temporary upload directory (multer)
├── output/              # Processed output files
└── package.json
```

## License

ISC
