import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { analyzeMedia } from "./analyzer.js";
import { makeDecision } from "./decider.js";
import { executeDecision } from "./executor.js";
import { createJob, updateJob, getJob, getAllJobs } from "./jobStore.js";


const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const upload = multer({
    dest: "uploads/",
    limits: { fileSize: 100 * 1024 * 1024 }
});

app.post("/analyze", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            error: "No file uploaded"
        });
    }
    try {
        const info = await analyzeMedia(req.file.path);
        return res.json({ success: true, data: info });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
    finally {
        if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
    }
})

app.post("/process", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            error: "No file uploaded"
        })
    }
    const target = {
        container: req.body.targetContainer || "mp4",
        videoCodec: req.body.targetVideoCodec || "h264",
        width: parseInt(req.body.targetWidth) || 1920,
        height: parseInt(req.body.targetHeight) || 1080,
        audioCodec: req.body.targetAudioCodec || "aac"
    };

    const jobId = createJob();
    try {
        updateJob(jobId, { status: "processing" })
        const info = await analyzeMedia(req.file.path)
        const decision = makeDecision(info, target)
        const execution = await executeDecision(req.file.path, decision, "output", target)
        const result = { jobId, analysis: info, decision, execution }
        updateJob(jobId, { status: "completed", result })
        return res.json({ success: true, data: result })

    } catch (error) {
        updateJob(jobId, { status: "failed", error: error.message })
        return res.status(500).json({ success: false, error: error.message })
    }

})

app.get("/jobs/:id", (req, res) => {
    const job = getJob(req.params.id)
    if (job == null) {
        return res.status(404).json({
            success: false,
            error: "Job not found"
        })
    }
    else {
        return res.json({
            success: true,
            data: job
        })
    }
});
app.get("/jobs", (req, res) => {
    return res.json({ success: true, data: getAllJobs() });
});




app.listen(PORT, () => {
    console.log("Server is running on port", PORT)
})