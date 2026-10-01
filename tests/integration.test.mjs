import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('HTTP service and real media conversion', {timeout:90000},async t=>{
  const ffmpeg=process.env.FFMPEG_PATH||'ffmpeg';
  assert.equal(spawnSync(ffmpeg,['-version'],{stdio:'ignore'}).status,0,'Install ffmpeg and ffprobe first (or use Docker).');
  const dir=await mkdtemp(path.join(tmpdir(),'mono-test-'));
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
  const port=socket.address().port;await new Promise(r=>socket.close(r));
  const origin=`http://127.0.0.1:${port}`,custom='https://mono.example.org';
  const server=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,NODE_ENV:'production',PORT:String(port),RENDER_EXTERNAL_URL:origin,PUBLIC_ORIGIN:custom,DOWNLOAD_DIR:path.join(dir,'downloads')},stdio:['ignore','pipe','pipe']});
  try {
    await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Server startup timeout')),20000);server.stdout.on('data',()=>{clearTimeout(timer);resolve()});server.once('exit',code=>{clearTimeout(timer);reject(Error('Server exited '+code))})});
    const request=(route,options={})=>fetch(origin+route,{...options,signal:AbortSignal.timeout(20000)});
    await t.test('health, public host and static files',async()=>{
      const r=await request('/api/health');assert.equal(r.status,200);assert.equal((await r.json()).ready,true);
      assert.equal((await request('/')).status,200);
      assert.equal((await request('/dist/../server.mjs')).status,404);
      assert.equal((await request('/api/files/unknown')).status,404);
      assert.equal((await request('/',{headers:{Host:'mono.example.org'}})).status,200);
      for(const asset of ['/app.js','/convert-ui.js','/style.css','/converter.css'])assert.equal((await request(asset)).status,200);
    });
    await t.test('origin, permission and URL validation',async()=>{
      const post=(body,originValue=origin)=>request('/api/jobs',{method:'POST',headers:{'Content-Type':'application/json',...(originValue?{Origin:originValue}:{})},body:JSON.stringify(body)});
      const valid={url:'http://127.0.0.1/internal',format:'mp3',quality:'128',rightsConfirmed:true};
      assert.equal((await post(valid,'https://attacker.example')).status,403);
      assert.equal((await post(valid,null)).status,403);
      assert.equal((await post({...valid,rightsConfirmed:false})).status,400);
      assert.equal((await post(valid)).status,400);
      assert.equal((await post({...valid,url:'https://youtube.com.evil.example/watch?v=abcdefghijk'})).status,400);
      assert.equal((await post(valid,custom)).status,400);
      assert.equal((await post(null)).status,400);
      assert.equal((await request('/api/convert?format=mp3&quality=128',{method:'POST',headers:{Origin:origin},body:'x'})).status,400);
    });
    const input=path.join(dir,'fixture.mp4');
    const generated=spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=160x90:r=10','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','0.5','-c:v','libx264','-threads','1','-c:a','aac','-y',input]);
    assert.equal(generated.status,0,generated.stderr?.toString());
    const bytes=await readFile(input);
    async function result(id){for(let i=0;i<200;i++){const job=await (await request('/api/jobs/'+id)).json();if(['complete','failed'].includes(job.state))return job;await new Promise(r=>setTimeout(r,100))}throw Error('Conversion timed out')}
    for(const [format,quality] of [['mp4','360'],['mkv','360'],['webm','360'],['mov','360'],['avi','360'],['m4v','360'],['mp3','128'],['wav','source'],['flac','source'],['aac','128'],['ogg','128'],['m4a','128']]){
      await t.test('uploaded media -> '+format,async()=>{
        const response=await request(`/api/convert?rightsConfirmed=true&format=${format}&quality=${quality}`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/octet-stream'},body:bytes});
        assert.equal(response.status,202);const {id}=await response.json();const job=await result(id);assert.equal(job.state,'complete',job.error);
        const download=await request('/api/files/'+id);assert.equal(download.status,200);assert.ok((await download.arrayBuffer()).byteLength>0);
      });
    }
    await t.test('malformed media fails and frees the slot',async()=>{
      const response=await request('/api/convert?rightsConfirmed=true&format=mp3&quality=128',{method:'POST',headers:{Origin:origin},body:'not media'});
      const {id}=await response.json();assert.equal((await result(id)).state,'failed');
      assert.equal((await request('/api/files/'+id)).status,404);
    });
    await t.test('rejects declared uploads over 100 MB without reading the body',async()=>{
      const status=await new Promise((resolve,reject)=>{
        const req=http.request(origin+'/api/convert?rightsConfirmed=true&format=mp3&quality=128',{method:'POST',headers:{Origin:origin,'Content-Length':'100000001'}},res=>{resolve(res.statusCode);res.resume();req.destroy()});
        req.on('error',reject);req.flushHeaders();
      });assert.equal(status,413);
    });
    await t.test('only one upload may occupy the server',async()=>{
      const held=http.request(origin+'/api/convert?rightsConfirmed=true&format=mp3&quality=128',{method:'POST',headers:{Origin:origin,'Content-Length':'10000'}});
      held.on('error',()=>{});held.write('pending');
      try{await new Promise(r=>setTimeout(r,100));const response=await request('/api/convert?rightsConfirmed=true&format=mp3&quality=128',{method:'POST',headers:{Origin:origin},body:bytes});assert.equal(response.status,429)}finally{held.destroy()}
      await new Promise(r=>setTimeout(r,100));
    });
    await t.test('rejects media longer than ten minutes',async()=>{
      const long=path.join(dir,'long.wav');assert.equal(spawnSync(ffmpeg,['-hide_banner','-loglevel','error','-f','lavfi','-i','sine=frequency=440:sample_rate=1000','-t','601','-y',long]).status,0);
      const response=await request('/api/convert?rightsConfirmed=true&format=mp3&quality=128',{method:'POST',headers:{Origin:origin},body:await readFile(long)});
      assert.equal(response.status,202);const {id}=await response.json();const job=await result(id);assert.equal(job.state,'failed');assert.match(job.error,/10 dakika/);
    });
  } finally {server.kill();await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(dir,{recursive:true,force:true});}
});
