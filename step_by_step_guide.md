# Step-by-Step Coding Guide

> Write each step yourself. I give you the **what**, **why**, and **hints** — you write the code.

---

## Your Current Status

- ✅ Folders created: `src/`, `tests/`, `uploads/`, `output/`, `samples/`
- ✅ `package.json` exists (but needs fixes)
- ✅ `analyzer.js` started (but incomplete — raw ffprobe output, no parsing, no export)
- ❌ No dependencies installed
- ❌ No sample files
- ❌ No other modules yet

---

## Phase 0 — Fix Setup

### Step 0.1 — Fix `package.json`

Your current `package.json` has `"type": "commonjs"` but your `analyzer.js` uses `import` syntax (ES modules). You have two choices:

**Option A:** Change `package.json` to `"type": "module"` — then you can use `import/export` everywhere.

**Option B:** Change your code to use `const { execFile } = require("child_process")` and `module.exports` — CommonJS style.

> **Pick one and be consistent.** I recommend **Option A** (ES modules) since you already started with `import`. Just change `"type": "commonjs"` → `"type": "module"` in `package.json`.

### Step 0.2 — Install dependencies

Run this in your terminal:
```bash
npm install express multer uuid
```

> **What each does:**
> - `express` — HTTP server framework
> - `multer` — parses file uploads from `multipart/form-data` requests
> - `uuid` — generates unique IDs like `"a1b2c3d4-e5f6-..."` for each job

### Step 0.3 — Add npm scripts

In `package.json`, replace the `"scripts"` section with:
```json
"scripts": {
  "start": "node src/server.js",
  "test:analyzer": "node tests/test-analyzer.js",
  "test:decider": "node tests/test-decider.js",
  "test:executor": "node tests/test-executor.js"
}
```

### Step 0.4 — Create sample files

Run these FFmpeg commands in your `samples/` folder to create test videos:

```bash
ffmpeg -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 -c:v libx264 -pix_fmt yuv420p samples/sample_match.mp4

ffmpeg -f lavfi -i testsrc=duration=5:size=1920x1080:rate=30 -c:v libx264 -pix_fmt yuv420p samples/sample_remux.mkv

ffmpeg -f lavfi -i testsrc=duration=5:size=720x480:rate=30 -c:v mpeg4 samples/sample_transcode.avi
```

> **Why these specific files?**
> - `sample_match.mp4` — MP4 + H.264 + 1080p → will trigger **SKIP** (already matches target)
> - `sample_remux.mkv` — MKV + H.264 + 1080p → will trigger **REMUX** (same codec, wrong container)
> - `sample_transcode.avi` — AVI + MPEG4 + 480p → will trigger **TRANSCODE** (different codec AND resolution)

---

## Phase 1 — Complete the Analyzer Module

Your `analyzer.js` currently returns the **raw** ffprobe JSON. That's a blob with deeply nested `streams[]` and `format` objects. You need to extract a **clean, flat object** from it.

### Step 1.1 — Understand what ffprobe returns

Before writing any parsing code, run this in your terminal to see what you're working with:

```bash
ffprobe -v quiet -print_format json -show_format -show_streams samples/sample_match.mp4
```

Study the output. You'll see something like:
```
{
  "streams": [
    {
      "codec_type": "video",
      "codec_name": "h264",
      "width": 1920,
      "height": 1080,
      "r_frame_rate": "30/1",
      ...
    }
  ],
  "format": {
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "duration": "5.000000",
    "size": "123456",
    ...
  }
}
```

> [!IMPORTANT]
> Notice: `format_name` is NOT `"mp4"` — it's `"mov,mp4,m4a,3gp,3g2,mj2"`. This is a comma-separated list of compatible format names. You MUST handle this.

### Step 1.2 — Write a parsing function inside `analyzer.js`

After the ffprobe Promise resolves with the raw JSON (`result`), you need to extract fields from it. Write a helper function called `parseMediaInfo(rawData)` that does:

1. **Find the video stream:** Loop through `rawData.streams` and find the one where `codec_type === "video"`
2. **Find the audio stream:** Same loop, find `codec_type === "audio"`
3. **Normalize the container name:** Take `rawData.format.format_name`, split by `,`, and map it to a simple name

   Here's the mapping logic you need:
   ```
   If the comma-separated list includes "mp4" → container is "mp4"
   If it includes "matroska" → container is "mkv"
   If it includes "avi" → container is "avi"
   If it includes "webm" → container is "webm"
   Otherwise → use the first item in the list
   ```

4. **Parse FPS:** `r_frame_rate` is a fraction string like `"30/1"` or `"30000/1001"`. Split by `/`, divide the two numbers, and round to 2 decimal places.

5. **Return this clean object:**
   ```
   {
     container:   (normalized string, e.g. "mp4")
     videoCodec:  (from video stream's codec_name, lowercased)
     width:       (from video stream, integer)
     height:      (from video stream, integer)
     fps:         (parsed from r_frame_rate, number)
     audioCodec:  (from audio stream's codec_name, lowercased — or null if no audio)
     duration:    (from format.duration, parseFloat)
     fileSize:    (from format.size, parseInt)
   }
   ```

> **Why lowercase everything?** Because later in the decider, you'll compare codec names. ffprobe might return `"h264"` or `"H264"` depending on the build. Normalizing to lowercase prevents false mismatches.

### Step 1.3 — Wire the parser into your existing function

Your current `analyzeMedia` resolves with `result` (raw JSON). Change it to resolve with `parseMediaInfo(result)` instead.

### Step 1.4 — Export the function

At the bottom of the file, add:
```javascript
export { analyzeMedia };
```

(Or if you chose CommonJS: `module.exports = { analyzeMedia };`)

### Step 1.5 — Handle edge cases

Add checks for:
- What if there's **no video stream**? (e.g. an MP3 file) → set video fields to `null`
- What if there's **no audio stream**? → set `audioCodec` to `null`
- What if `r_frame_rate` is `"0/0"`? → set fps to `0` or `null` (don't divide by zero!)

### Step 1.6 — Write the test file `tests/test-analyzer.js`

Create this file. It should:

1. Import `analyzeMedia` from `../src/analyzer.js`
2. Call `analyzeMedia("samples/sample_match.mp4")`
3. `console.log` the result
4. Do the same for `sample_remux.mkv` and `sample_transcode.avi`

Use `async/await` since `analyzeMedia` returns a Promise:
```
async function main() {
  const info1 = await analyzeMedia("samples/sample_match.mp4");
  console.log("MP4:", info1);
  // ... repeat for other files
}
main();
```

### Step 1.7 — Run and verify

```bash
npm run test:analyzer
```

**Check that the output makes sense:**
- `sample_match.mp4` → container should be `"mp4"`, videoCodec `"h264"`, width `1920`, height `1080`
- `sample_remux.mkv` → container should be `"mkv"`, videoCodec `"h264"`
- `sample_transcode.avi` → container should be `"avi"`, videoCodec `"mpeg4"`, width `720`, height `480`

> [!TIP]
> **Do NOT move to Phase 2 until this output is correct.** Every later phase depends on accurate analysis.

---

## Phase 2 — Decision Module

### Step 2.1 — Create `src/decider.js`

Create a new file. Export a single function:

```
function makeDecision(inputInfo, targetSpec) { ... }
```

**Parameters:**
- `inputInfo` — the object returned by your analyzer (container, videoCodec, width, height, audioCodec, etc.)
- `targetSpec` — an object with the same shape describing what you WANT the file to be:
  ```
  {
    container: "mp4",
    videoCodec: "h264",
    width: 1920,
    height: 1080,
    audioCodec: "aac"
  }
  ```

### Step 2.2 — Write the comparison logic

Inside `makeDecision`, compare fields **one by one** and build a reasons array. Here's the logic in pseudocode:

```
1. Compare videoCodec (both lowercased):
   - inputInfo.videoCodec === targetSpec.videoCodec?
   - Store result: codecMatches = true/false

2. Compare resolution:
   - inputInfo.width === targetSpec.width AND inputInfo.height === targetSpec.height?
   - Store result: resolutionMatches = true/false

3. Compare container (both lowercased):
   - inputInfo.container === targetSpec.container?
   - Store result: containerMatches = true/false

4. Compare audioCodec (both lowercased):
   - If targetSpec.audioCodec is not specified → treat as match (don't care)
   - Otherwise: inputInfo.audioCodec === targetSpec.audioCodec?
   - Store result: audioMatches = true/false

5. DECISION:
   - If codecMatches AND resolutionMatches AND containerMatches AND audioMatches:
     → action = "SKIP"
   - Else if codecMatches AND resolutionMatches (but container or audio differs):
     → If only container differs: action = "REMUX"
     → If audio also differs but codec/resolution match: action = "TRANSCODE"
       (you can't remux if you need to re-encode audio)
   - Else (codec OR resolution differs):
     → action = "TRANSCODE"
```

> [!IMPORTANT]
> **Why can't you remux when audio codec differs?**
> Remux = `-c copy` (copy ALL streams without re-encoding). If the audio codec needs to change, you'd need `-c:a aac` which IS re-encoding — that makes it a transcode, not a remux.
>
> However, some people define "remux" as copying video + re-encoding audio. For simplicity, if ONLY the audio differs (and video codec + resolution + container all match), you could still call it a partial transcode. **Pick one approach and document it.**

### Step 2.3 — Build the reason string

Don't just return `"TRANSCODE"` — explain **why**. Build a `reasons` array:

```
const reasons = [];
if (!codecMatches) reasons.push(`Video codec differs: ${inputInfo.videoCodec} → ${targetSpec.videoCodec}`);
if (!resolutionMatches) reasons.push(`Resolution differs: ${inputInfo.width}x${inputInfo.height} → ${targetSpec.width}x${targetSpec.height}`);
if (!containerMatches) reasons.push(`Container differs: ${inputInfo.container} → ${targetSpec.container}`);
if (!audioMatches) reasons.push(`Audio codec differs: ${inputInfo.audioCodec} → ${targetSpec.audioCodec}`);
```

Then join them: `reasons.join(". ")`

For SKIP, the reason is: `"File already matches target specification"`

### Step 2.4 — Return the decision object

```javascript
return {
  action: "SKIP" | "REMUX" | "TRANSCODE",
  reason: "...",            // human-readable explanation
  outputExtension: "mp4"   // the target container extension
}
```

### Step 2.5 — Export the function

```javascript
export { makeDecision };
```

### Step 2.6 — Write the test file `tests/test-decider.js`

This test should NOT use real files. Hardcode input objects:

```javascript
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
```

> **Why test with hardcoded objects?** This is a pure function — no files, no ffprobe, no FFmpeg. You can test all edge cases in milliseconds. This is the power of separating decision logic from I/O.

### Step 2.7 — Run and verify

```bash
npm run test:decider
```

You should see all four ✅. If any is ❌, fix your logic before moving on.

---

## Phase 3 — Executor Module

### Step 3.1 — Create `src/executor.js`

Import what you'll need:
```javascript
import { execFile } from "child_process";
import fs from "fs";
import path from "path";
```

Export a function:
```
function executeDecision(inputPath, decision, outputDir) { ... }
```

### Step 3.2 — Handle the SKIP case

If `decision.action === "SKIP"`:
- Don't run FFmpeg
- Just return immediately with:
  ```
  {
    action: "SKIP",
    inputFile: inputPath,
    outputFile: null,
    processingTimeMs: 0,
    inputSizeBytes: fs.statSync(inputPath).size,
    outputSizeBytes: null,
    sizeDeltaPercent: 0
  }
  ```

### Step 3.3 — Build the output filename

For REMUX and TRANSCODE, you need to generate a unique output filename:

```
1. Get the base name of the input file (without extension)
   e.g. "sample_remux" from "samples/sample_remux.mkv"
2. Append a timestamp to make it unique: `${baseName}_${Date.now()}`
3. Add the target extension: `.${decision.outputExtension}`
4. Full path: path.join(outputDir, filename)
```

### Step 3.4 — Build the FFmpeg arguments

**For REMUX** (copy streams, change container):
```
["-i", inputPath, "-c", "copy", "-y", outputPath]
```

> **What each flag does:**
> - `-i inputPath` — input file
> - `-c copy` — copy ALL streams without re-encoding (this is what makes it a remux!)
> - `-y` — overwrite output if it exists (prevents FFmpeg from prompting and hanging)

**For TRANSCODE** (re-encode):
```
[
  "-i", inputPath,
  "-c:v", "libx264",        // encode video with H.264
  "-preset", "medium",       // speed/quality balance
  "-crf", "23",              // quality level (lower = better)
  "-s", `${targetWidth}x${targetHeight}`,  // resize
  "-c:a", "aac",             // encode audio with AAC
  "-b:a", "128k",            // audio bitrate
  "-y",                      // overwrite
  outputPath
]
```

> [!NOTE]
> **Where do you get `targetWidth` and `targetHeight`?**
> You need to pass the target spec into the executor, or include it in the decision object. The easiest approach: have your decider include `ffmpegArgs` in its return value, or pass `targetSpec` as an extra parameter to `executeDecision`.

### Step 3.5 — Run FFmpeg and capture metrics

Wrap it in a Promise, same pattern as your analyzer:

```
1. Record startTime = Date.now()
2. Get inputSize = fs.statSync(inputPath).size
3. execFile("ffmpeg", args, callback)
4. In the callback:
   - If error → reject with descriptive error (include stderr!)
   - If success:
     - endTime = Date.now()
     - outputSize = fs.statSync(outputPath).size
     - processingTimeMs = endTime - startTime
     - sizeDeltaPercent = ((outputSize - inputSize) / inputSize) * 100
     - resolve the result object
```

> [!WARNING]
> **FFmpeg writes to stderr even on success!** It outputs progress information, encoding stats, etc. to stderr. Only check the `error` parameter (exit code) to determine success/failure, NOT whether stderr has content.

### Step 3.6 — Increase execFile buffer size

FFmpeg can produce a LOT of stderr output. By default, `execFile` has a 1MB buffer limit. Add:

```javascript
execFile("ffmpeg", args, { maxBuffer: 10 * 1024 * 1024 }, callback)
```

This sets the buffer to 10MB, preventing "maxBuffer exceeded" crashes.

### Step 3.7 — Export the function

```javascript
export { executeDecision };
```

### Step 3.8 — Write the test file `tests/test-executor.js`

This test runs the **full chain** on one file:

```
1. Import analyzeMedia, makeDecision, executeDecision
2. Define target = { container: "mp4", videoCodec: "h264", width: 1920, height: 1080, audioCodec: "aac" }
3. const info = await analyzeMedia("samples/sample_remux.mkv")
4. const decision = makeDecision(info, target)
5. const result = await executeDecision("samples/sample_remux.mkv", decision, "output")
6. console.log the entire result
```

### Step 3.9 — Run and verify

```bash
npm run test:executor
```

**Check:**
- An output file appeared in `output/`
- `processingTimeMs` is a reasonable number (remux should be < 2 seconds for a 5-second clip)
- Open the output file in a media player — does it play?

---

## Phase 4 — Express API

### Step 4.1 — Create `src/jobStore.js`

This is a simple in-memory store. You need:

```javascript
// A Map to store jobs
const jobs = new Map();

// createJob() → creates a new job entry, returns the ID
//   Generate ID using: import { v4 as uuidv4 } from "uuid"
//   Store: { id, status: "pending", createdAt: new Date(), result: null }

// updateJob(id, updates) → merges updates into the existing job
//   e.g. updateJob(id, { status: "completed", result: {...}, completedAt: new Date() })

// getJob(id) → returns the job object, or null if not found

// getAllJobs() → returns Array.from(jobs.values())

// Export all four functions
```

> **Why a Map instead of a plain object?** `Map` preserves insertion order, has a `.size` property, and has cleaner semantics for a key-value store. But a plain `{}` would work too for this use case.

### Step 4.2 — Create `src/server.js` — imports and setup

At the top of the file, import everything:

```javascript
import express from "express";
import multer from "multer";
import path from "path";
import { analyzeMedia } from "./analyzer.js";
import { makeDecision } from "./decider.js";
import { executeDecision } from "./executor.js";
import { createJob, updateJob, getJob, getAllJobs } from "./jobStore.js";
```

Create the Express app and configure multer:

```javascript
const app = express();
const PORT = 3000;

// Tell Express to parse JSON bodies (for non-file fields)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer
const upload = multer({
  dest: "uploads/",        // where to save uploaded files
  limits: { fileSize: 100 * 1024 * 1024 }  // 100MB limit
});
```

> [!IMPORTANT]
> **What `multer({ dest: "uploads/" })` does:**
> When a file is uploaded, multer saves it to `uploads/` with a random filename (no extension). It then attaches `req.file` to the request with:
> - `req.file.path` → `"uploads/abc123def456"` (the saved file)
> - `req.file.originalname` → `"my_video.mkv"` (the original name)
> - `req.file.size` → file size in bytes
>
> The field name in your curl/form MUST match what you pass to `upload.single("file")`.

### Step 4.3 — POST /analyze endpoint

```
app.post("/analyze", upload.single("file"), async (req, res) => {
  1. Check if req.file exists → if not, return 400 error
  2. try:
     - const info = await analyzeMedia(req.file.path)
     - return res.json({ success: true, data: info })
  3. catch:
     - return res.status(500).json({ success: false, error: err.message })
  4. finally:
     - Clean up: delete the uploaded file with fs.unlinkSync(req.file.path)
       (optional but good practice — don't fill up uploads/)
});
```

> **Why `upload.single("file")` is middleware:** It sits between the route path and your handler. Express calls multer first → multer parses the upload → then your handler runs. Without this middleware, `req.file` would be `undefined`.

### Step 4.4 — POST /process endpoint

This is the big one. The full pipeline:

```
app.post("/process", upload.single("file"), async (req, res) => {
  1. Check if req.file exists → if not, return 400

  2. Build the target spec from request body:
     const target = {
       container: req.body.targetContainer || "mp4",
       videoCodec: req.body.targetVideoCodec || "h264",
       width: parseInt(req.body.targetWidth) || 1920,
       height: parseInt(req.body.targetHeight) || 1080,
       audioCodec: req.body.targetAudioCodec || "aac"
     };

  3. Create a job:
     const jobId = createJob();

  4. try:
     a. updateJob(jobId, { status: "processing" })
     b. const info = await analyzeMedia(req.file.path)
     c. const decision = makeDecision(info, target)
     d. const execution = await executeDecision(req.file.path, decision, "output")
     e. const result = { jobId, analysis: info, decision, execution }
     f. updateJob(jobId, { status: "completed", result })
     g. return res.json({ success: true, data: result })

  5. catch:
     a. updateJob(jobId, { status: "failed", error: err.message })
     b. return res.status(500).json({ success: false, error: err.message })
});
```

> **Why are target params in the form body, not JSON?**
> Because the request is `multipart/form-data` (required for file upload). You can't mix JSON body with file uploads in a single request easily. Multer makes non-file form fields available on `req.body`.

### Step 4.5 — GET /jobs/:id endpoint

```
app.get("/jobs/:id", (req, res) => {
  1. const job = getJob(req.params.id)
  2. If job is null → return 404 with { success: false, error: "Job not found" }
  3. Otherwise → return res.json({ success: true, data: job })
});
```

### Step 4.6 — GET /jobs endpoint (bonus)

```
app.get("/jobs", (req, res) => {
  return res.json({ success: true, data: getAllJobs() });
});
```

### Step 4.7 — Start the server

```javascript
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

### Step 4.8 — Run and quick-test

```bash
npm start
```

In another terminal, test the analyze endpoint:
```bash
curl -X POST -F "file=@samples/sample_match.mp4" http://localhost:3000/analyze
```

You should get back your clean media info JSON.

---

## Phase 5 — Integration Testing

### Step 5.1 — Test SKIP

```bash
curl -X POST -F "file=@samples/sample_match.mp4" -F "targetContainer=mp4" -F "targetVideoCodec=h264" -F "targetWidth=1920" -F "targetHeight=1080" -F "targetAudioCodec=aac" http://localhost:3000/process
```

**Verify:** `decision.action` should be `"SKIP"`

### Step 5.2 — Test REMUX

```bash
curl -X POST -F "file=@samples/sample_remux.mkv" -F "targetContainer=mp4" -F "targetVideoCodec=h264" -F "targetWidth=1920" -F "targetHeight=1080" http://localhost:3000/process
```

**Verify:** `decision.action` should be `"REMUX"`, output file exists in `output/`

### Step 5.3 — Test TRANSCODE

```bash
curl -X POST -F "file=@samples/sample_transcode.avi" -F "targetContainer=mp4" -F "targetVideoCodec=h264" -F "targetWidth=1920" -F "targetHeight=1080" http://localhost:3000/process
```

**Verify:** `decision.action` should be `"TRANSCODE"`, takes longer, output file is 1080p

### Step 5.4 — Test job retrieval

Take a `jobId` from any response above and:

```bash
curl http://localhost:3000/jobs/<paste-job-id-here>
```

### Step 5.5 — Common failures at this stage

| Symptom | Likely Cause | Fix |
|---|---|---|
| SKIP comes back as REMUX | Container normalization wrong — ffprobe returns `"mov,mp4,..."` and your normalizer returns something other than `"mp4"` | Debug your `parseMediaInfo` function, log the raw `format_name` |
| REMUX comes back as TRANSCODE | Audio codec mismatch you didn't expect | Log all fields being compared, check if audio codecs are the same |
| `req.file` is `undefined` | Missing `upload.single("file")` middleware, or wrong field name in curl (`-F "file=@..."` must match the string in `upload.single("file")`) | Double-check middleware and curl field name |
| FFmpeg error: "codec not found" | `libx264` not compiled into your FFmpeg build | Run `ffmpeg -codecs | grep h264` to verify |
| Output file is 0 bytes | FFmpeg silently failed — check stderr output | Log stderr in your executor, even on "success" |

---

## Phase 6 — README

### Step 6.1 — Write the README

Structure it like this:

```markdown
# Smart Remux/Transcode Decider CLI

## What is this?
One paragraph: what the tool does.

## Remux vs Transcode
Explain in YOUR words. Use the envelope analogy or your own.

## Setup
Prerequisites, npm install, creating sample files.

## API Endpoints
Table of endpoints with method, path, description.

## Examples

### SKIP Example
Show the curl command and the response JSON.

### REMUX Example
Show the curl command and the response JSON.

### TRANSCODE Example
Show the curl command and the response JSON.

## Architecture
Brief: analyzer → decider → executor pipeline.

## Connection to D2CFoundry
One paragraph: This decision logic is what would run on each
incoming stream in D2CFoundry's Recording Service before storage.
By detecting when a remux suffices vs a full transcode, the service
avoids unnecessary compute — saving cost and reducing latency.
```

---

## Checklist — Track Your Progress

```
Phase 0:
  [ ] package.json fixed ("type": "module")
  [ ] Dependencies installed (express, multer, uuid)
  [ ] npm scripts added
  [ ] Sample files created

Phase 1:
  [ ] parseMediaInfo() written with container normalization
  [ ] analyzeMedia() returns parsed (not raw) output
  [ ] Function exported
  [ ] test-analyzer.js passes with correct output for all 3 samples

Phase 2:
  [ ] makeDecision() written with all 3 branches
  [ ] Reason strings built dynamically
  [ ] Function exported
  [ ] test-decider.js passes all 4 test cases (✅✅✅✅)

Phase 3:
  [ ] executeDecision() handles SKIP, REMUX, TRANSCODE
  [ ] Timing and file size metrics captured
  [ ] maxBuffer increased
  [ ] Function exported
  [ ] test-executor.js produces valid output file

Phase 4:
  [ ] jobStore.js with create/update/get/getAll
  [ ] POST /analyze works
  [ ] POST /process works
  [ ] GET /jobs/:id works
  [ ] Multer configured correctly

Phase 5:
  [ ] SKIP test passes
  [ ] REMUX test passes
  [ ] TRANSCODE test passes
  [ ] Job retrieval works

Phase 6:
  [ ] README complete with all sections
```
