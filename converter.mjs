import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdir,rm,statfs,stat} from 'node:fs/promises';
import {Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import path from 'node:path';
import {validOutput,isVideo,outputArgs} from './media-formats.mjs';
import {tools,MAX_BYTES,MAX_SECONDS,TIMEOUT_MS} from './runtime.mjs';
const containers='mov,matroska,webm,avi,wav,mp3,flac,ogg,aac';
export function processFile(exe,args,onProgress){return new Promise((resolve,reject)=>{const child=spawn(exe,args,{windowsHide:true,detached:process.platform!=='win32'});let out='',err='',ended=false;const timer=setTimeout(()=>{try{process.platform==='win32'?child.kill():process.kill(-child.pid,'SIGKILL')}catch{};finish(Error('İşlem zaman aşımına uğradı. Daha kısa bir dosya dene.'))},TIMEOUT_MS);function finish(error){if(ended)return;ended=true;clearTimeout(timer);error?reject(error):resolve(out)}child.stdout.on('data',c=>{out=(out+c).slice(-100000);onProgress?.(c.toString())});child.stderr.on('data',c=>{err=(err+c).slice(-3000)});child.once('error',()=>finish(Error('Dönüştürme aracı başlatılamadı.')));child.once('close',code=>finish(code===0?null:Error('Dosya okunamadı veya dönüştürülemedi. Desteklenen bir video ya da ses dosyası dene.')))});}
export async function uploadConversion(req,res,url,{root,bin,jobs,reserve,release,json}){
const format=url.searchParams.get('format'),quality=url.searchParams.get('quality');
if(!validOutput(format,quality)){json(res,400,{error:'Format veya kalite geçersiz.'});return}
if(Number(req.headers['content-length'])>MAX_BYTES){req.resume();json(res,413,{error:'Dosya yükleme sınırı 100 MB.'});return}
const disk=await statfs(root);const required=Number(req.headers['content-length']||0)+300_000_000;if(disk.bavail*disk.bsize<required){req.resume();json(res,507,{error:'Dosyayı yüklemek için yeterli disk alanı yok. Diskte yer açıp yeniden dene.'});return}
if(!reserve()){req.resume();json(res,429,{error:'Sunucu bir dosya hazırlıyor. Tamamlanınca yeniden dene.'});return}
const id=randomUUID(),dir=path.join(root,id),input=path.join(dir,'source.upload');let size=0;
try{await mkdir(dir,{recursive:true});await pipeline(req,new Transform({transform(chunk,encoding,cb){size+=chunk.length;cb(size>MAX_BYTES?Error('Dosya yükleme sınırı 100 MB.'):null,chunk)}}),createWriteStream(input,{flags:'wx'}));if(!size)throw Error('Dosya boş. Başka bir dosya seç.');
const job={id,format,quality,state:'running',progress:0,created:Date.now()};jobs.set(id,job);json(res,202,{id});
(async()=>{try{const info=JSON.parse(await processFile(tools.ffprobe,['-v','error','-protocol_whitelist','file,pipe','-format_whitelist',containers,'-show_format','-show_streams','-of','json',input]));const duration=Number(info.format?.duration);if(duration>MAX_SECONDS)throw Error('Dosya süresi en fazla 10 dakika olabilir.');if(!Number.isFinite(duration)||duration<=0)throw Error('Dosyanın süresi okunamadı. Başka bir dosya seç.');const video=info.streams.some(s=>s.codec_type==='video'&&!s.disposition?.attached_pic),audio=info.streams.some(s=>s.codec_type==='audio');if(isVideo(format)&&!video)throw Error(format.toUpperCase()+' için video içeren bir dosya seç. Ses dosyalarını ses uzantılarına dönüştürebilirsin.');if(!isVideo(format)&&!audio)throw Error('Bu dosyada ses bulunamadı.');
const file=path.join(dir,'mono-donusturulen.'+format);const encoding=outputArgs(format,quality);
await processFile(tools.ffmpeg,['-hide_banner','-nostdin','-v','error','-protocol_whitelist','file,pipe','-format_whitelist',containers,'-i',input,...encoding,'-progress','pipe:1','-nostats','-fs',String(MAX_BYTES*2),'-y',file],chunk=>{const times=[...chunk.matchAll(/out_time_us=(\d+)/g)];if(times.length)job.progress=Math.min(99,Number(times.at(-1)[1])/1000000/duration*100)});if((await stat(file)).size>=MAX_BYTES*2)throw Error('Çıkış dosyası sınırı aşıldı. Daha düşük kalite dene.');job.file=file;job.filename=path.basename(file);job.progress=100;job.state='complete';
}catch(error){job.state='failed';job.error=error.message}finally{job.finishedAt=Date.now();if(job.state==='failed')await rm(dir,{recursive:true,force:true}).catch(()=>{});release();await rm(input,{force:true}).catch(()=>{})}})();
}catch(error){release();await rm(dir,{recursive:true,force:true}).catch(()=>{});if(!res.headersSent&&!res.destroyed)json(res,size>MAX_BYTES?413:400,{error:error.message})}
}
