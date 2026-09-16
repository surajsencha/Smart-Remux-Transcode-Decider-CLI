import { v4 as uuidv4 } from "uuid"
const jobs = new Map();

export function createJob() {
    const id = uuidv4();
    jobs.set(id, {
        id,
        status: "pending",
        createdAt: Date.now(),
        result: null
    })
    return id;
}

export function updateJob(id, updates) {
    const job = jobs.get(id)
    if (!job) return;
    Object.assign(job, updates);
    jobs.set(id, job);
    return job;
}

export function getJob(id) {
    const job = jobs.get(id)
    if (!job) return;
    return job;
}

export function getAllJobs() {
    return Array.from(jobs.values());
}

