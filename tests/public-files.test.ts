import {test} from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {publicFiles} from '../server/publicFiles.ts';

test('HTML compilado antigo não substitui entradas do Vite; imagens continuam disponíveis',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'inex-public-test-'));
 fs.writeFileSync(path.join(dir,'index.html'),'OLD app-CJfQ8-sj.js');
 fs.writeFileSync(path.join(dir,'admin.html'),'OLD ADMIN');
 fs.writeFileSync(path.join(dir,'icon.svg'),'<svg/>');
 const app=express();app.use(publicFiles(dir,false));app.use((_req,res)=>res.send('VITE SOURCE'));
 const server=app.listen(0,'127.0.0.1');
 try{
  await new Promise<void>(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${(server.address() as any).port}`;
  for(const route of ['/','/index.html','/admin.html','/login'])assert.equal(await (await fetch(base+route)).text(),'VITE SOURCE');
  assert.equal(await (await fetch(base+'/icon.svg')).text(),'<svg/>');
 }finally{await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));fs.rmSync(dir,{recursive:true,force:true});}
});
