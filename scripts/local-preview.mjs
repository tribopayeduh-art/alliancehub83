import {spawnSync,spawn} from 'node:child_process';
// A fresh local build avoids Vite dependency-cache and stale staged HTML.
const result=spawnSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{stdio:'inherit',env:{...process.env,NODE_ENV:'production',VERCEL:'0'}});
if(result.status!==0)process.exit(result.status||1);
const port=process.env.LOCAL_PORT||'3001';
console.log(`Abrindo versão recém-compilada em http://localhost:${port}`);
const server=spawn(process.execPath,['--import','tsx','server.ts'],{stdio:'inherit',env:{...process.env,NODE_ENV:'production',VERCEL:'0',PORT:port,DEFAULT_APP_PORT:'',CONTROL_PLANE_PORT:''}});
server.on('exit',code=>process.exit(code||0));
process.on('SIGINT',()=>server.kill('SIGINT'));
