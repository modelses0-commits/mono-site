import {spawnSync} from 'node:child_process';
export const MAX_BYTES=100_000_000,MAX_SECONDS=600,TIMEOUT_MS=10*60*1000;
export const tools={ytdlp:process.env.YTDLP_PATH||'yt-dlp',ffmpeg:process.env.FFMPEG_PATH||'ffmpeg',ffprobe:process.env.FFPROBE_PATH||'ffprobe',bin:process.env.FFMPEG_DIR||'/usr/bin'};
// Probe once at startup; health checks never spawn expensive processes.
const available=Object.entries(tools).filter(([key])=>key!=='bin').every(([key,exe])=>spawnSync(exe,[key==='ytdlp'?'--version':'-version'],{timeout:10000,windowsHide:true,stdio:'ignore'}).status===0);
export const ready=()=>available;
if(!available)console.error('yt-dlp / ffmpeg / ffprobe eksik. Docker kurulumunu kullanın.');
