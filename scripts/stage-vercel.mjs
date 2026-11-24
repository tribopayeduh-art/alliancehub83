import { games, gameEntry } from './game-page-seo.mjs';
import fs from 'node:fs';
import path from 'node:path';
if(process.env.VERCEL === '1') {
 const shell = fs.readFileSync('dist/index.html','utf8');
 fs.mkdirSync('dist/game-entry',{recursive:true});
 for (const game of games) fs.writeFileSync(path.join('dist','game-entry',game[0]+'.html'),gameEntry(shell,game));
 // Vercel serves public/ directly; Express static middleware is not used there.
 for(const entry of fs.readdirSync('dist')) fs.cpSync(path.join('dist',entry),path.join('public',entry),{recursive:true});
 console.log('Frontend compilado preparado em public/ para Vercel.');
}
