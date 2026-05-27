/**
 * ffmpegWorker.js — Node.js Worker Thread
 * Receives { inputPath, outputName } via workerData,
 * runs FFmpeg to extract audio as MP3, posts result back.
 *
 * Usage from main thread:
 *   const { Worker } = require('worker_threads');
 *   const worker = new Worker('./src/workers/ffmpegWorker.js', {
 *     workerData: { inputPath: '/tmp/video.mp4', outputName: 'clip-abc' }
 *   });
 *   worker.on('message', ({ success, outputPath, error }) => { ... });
 */

const { workerData, parentPort } = require('worker_threads');
const { execFile } = require('child_process');
const path = require('path');
const os   = require('os');
const fs   = require('fs');

const { inputPath, outputName } = workerData;
const outputPath = path.join(os.tmpdir(), `${outputName}.mp3`);

// Check FFmpeg is installed
execFile('ffmpeg', ['-version'], (vErr) => {
  if (vErr) {
    parentPort.postMessage({ success: false, error: 'ffmpeg not found. Install with: apt install ffmpeg' });
    return;
  }

  execFile('ffmpeg', [
    '-i', inputPath,
    '-vn',              // no video
    '-ar', '44100',     // sample rate
    '-ac', '2',         // stereo
    '-b:a', '192k',     // bitrate
    '-y',               // overwrite if exists
    outputPath,
  ], (err, stdout, stderr) => {
    // Clean up input file regardless of outcome
    try { fs.unlinkSync(inputPath); } catch {}

    if (err) {
      parentPort.postMessage({ success: false, error: stderr || err.message });
    } else {
      parentPort.postMessage({ success: true, outputPath });
    }
  });
});
