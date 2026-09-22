import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../dist/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.json':'application/json','.xml':'application/xml','.txt':'text/plain','.png':'image/png','.ico':'image/x-icon'};
createServer(async(req,res)=>{
 try {
  const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  let file=resolve(root,`.${path}`);
  if(file!==resolve(root)&&!file.startsWith(resolve(root)+sep)){res.writeHead(403);res.end();return;}
  try {if((await stat(file)).isDirectory())file=resolve(file,'index.html');}catch{}
  let data;let status=200;
  try{data=await readFile(file);}catch{data=await readFile(resolve(root,'404.html'));file='404.html';status=404;}
  res.writeHead(status,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(data);
 }catch{res.writeHead(400);res.end('Invalid request');}
}).listen(4321,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4321'));
