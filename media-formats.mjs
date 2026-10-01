export const VIDEO_FORMATS=['mp4','mkv','webm','mov','avi','m4v'];
export const AUDIO_FORMATS=['mp3','wav','flac','aac','ogg','m4a'];
export const isVideo=format=>VIDEO_FORMATS.includes(format);
export function validOutput(format,quality){return isVideo(format)?['1080','720','480','360'].includes(quality):AUDIO_FORMATS.includes(format)&&( ['wav','flac'].includes(format)?quality==='source':(format==='mp3'?['320','192','128']:['256','192','128']).includes(quality))}
export const mimeTypes={mp4:'video/mp4',mkv:'video/x-matroska',webm:'video/webm',mov:'video/quicktime',avi:'video/x-msvideo',m4v:'video/mp4',mp3:'audio/mpeg',wav:'audio/wav',flac:'audio/flac',aac:'audio/aac',ogg:'audio/ogg',m4a:'audio/mp4'};
export function outputArgs(format,quality){
if(!validOutput(format,quality))throw Error('Format veya kalite geçersiz.');
if(!isVideo(format)){const base=['-map','0:a:0','-vn','-threads','1'];const codecs={mp3:['-c:a','libmp3lame','-b:a',quality+'k'],wav:['-c:a','pcm_s16le'],flac:['-c:a','flac'],aac:['-c:a','aac','-b:a',quality+'k'],ogg:['-c:a','libvorbis','-b:a',quality+'k'],m4a:['-c:a','aac','-b:a',quality+'k','-movflags','+faststart']};return [...base,...codecs[format]]}
const scale=`scale=w='min(iw,${Number(quality)*16/9})':h='min(ih,${quality})':force_original_aspect_ratio=decrease:force_divisible_by=2`;
const base=['-map','0:v:0','-map','0:a:0?','-vf',scale,'-pix_fmt','yuv420p','-threads','1'];
if(format==='webm')return [...base,'-c:v','libvpx-vp9','-deadline','realtime','-cpu-used','6','-crf','32','-b:v','0','-c:a','libopus','-b:a','128k'];
if(format==='avi')return [...base,'-c:v','mpeg4','-q:v','4','-c:a','libmp3lame','-b:a','192k'];
return [...base,'-c:v','libx264','-preset','fast','-crf','23','-c:a','aac','-b:a','192k',...(['mp4','mov','m4v'].includes(format)?['-movflags','+faststart']:[]),...(format==='m4v'?['-f','mp4']:[])];
}
