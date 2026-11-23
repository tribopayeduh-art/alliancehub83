import fs from 'node:fs';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
const file='.env.local';
if(!fs.existsSync(file))fs.copyFileSync('.env.example',file);
let content=fs.readFileSync(file,'utf8'),config=dotenv.parse(content);
for(const key of ['JWT_SECRET','SYSTEM_ENCRYPTION_KEY','CRON_SECRET']){
 if(config[key]?.trim())continue;
 const value=crypto.randomBytes(32).toString('hex'),line=`${key}=${value}`;
 const pattern=new RegExp('^'+key+'=.*$','m');content=pattern.test(content)?content.replace(pattern,line):content+'\n'+line+'\n';
}
fs.writeFileSync(file,content,{mode:0o600});config=dotenv.parse(content);
const required=['SUPABASE_URL','SUPABASE_SECRET_KEY'];
console.log('Arquivo de ambiente preparado. Chaves existentes foram preservadas; novos segredos não foram exibidos.');
for(const key of [...required,'PIXUP_CLIENT_ID','PIXUP_CLIENT_SECRET','PIXUP_POSTBACK_URL'])console.log(`${key}: ${config[key]?.trim()?'preenchido':'pendente'}`);
console.log('Na Vercel, copie as variáveis privadas para Environment Variables; não envie o .env ao GitHub.');
