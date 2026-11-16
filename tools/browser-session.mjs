import { Camoufox } from 'camoufox';
import { mkdir, readFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { registerControls, allowed, harvest } from './browser-control.mjs';
import { navigateAtStartup } from './startup-navigation.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const state=resolve(homedir(),'.local/share/chess-ygp-assist');
const profile=resolve(state,'profiles/flyordie');
await mkdir(profile,{recursive:true,mode:0o700});
const context=await Camoufox({browser:'158.0.1-beta.41',persistent_context:true,user_data_dir:profile,headless:false,os:'linux',locale:'pt-BR',main_world_eval:true,acceptDownloads:false,ignoreHTTPSErrors:false});
const bundle=await readFile(resolve(root,'dist/chess-assist.js'),'utf8');
await context.addInitScript('mw:'+bundle);
await registerControls(context);
let page=context.pages()[0]||await context.newPage();
const safeUrl=url=>{try{const u=new URL(url);return u.origin+u.pathname;}catch{return 'about:blank';}};
console.log(JSON.stringify({event:'browser-open',profile,browser:'Camoufox 158.0.1-beta.41',runtime:process.version}));
const navigationReady=await navigateAtStartup(async()=>{
  if(!allowed(page.mainFrame()))await page.goto('https://www.flyordie.com/chess',{waitUntil:'domcontentloaded',timeout:60000});
  else await page.reload({waitUntil:'domcontentloaded'});
});
await page.bringToFront();
console.log(JSON.stringify({event:navigationReady?'ready':'navigation-blocked',pages:context.pages().map(p=>safeUrl(p.url()))}));
const rl=createInterface({input:process.stdin,crlfDelay:Infinity});
let queue=Promise.resolve();
async function dispatch(command){
  if(page.isClosed()||!allowed(page.mainFrame()))page=context.pages().find(p=>!p.isClosed()&&allowed(p.mainFrame()))||context.pages().find(p=>!p.isClosed())||await context.newPage();
  if(Number.isInteger(command.page))page=context.pages()[command.page]||page;
  let frame=command.framePath?page.frames().find(f=>{try{return new URL(f.url()).pathname===command.framePath;}catch{return false;}}):Number.isInteger(command.frame)?page.frames()[command.frame]:page.mainFrame();
  if(command.cmd==='pages')return context.pages().map((p,i)=>({i,url:safeUrl(p.url()),frames:p.frames().map((f,j)=>({j,url:safeUrl(f.url())}))}));
  if(command.cmd==='evaluate')return frame.evaluate((command.main?'mw:':'')+command.code);
  if(command.cmd==='inject')return frame.evaluate('mw:'+await readFile(resolve(root,'dist/chess-assist.js'),'utf8'));
  if(command.cmd==='harvest')return harvest(page,frame);
  if(command.cmd==='click'){if(command.selector)await frame.locator(command.selector).click({timeout:15000});else await page.mouse.click(command.x,command.y);return 'clicked';}
  if(command.cmd==='wheel'){await page.mouse.move(command.x,command.y);await page.mouse.wheel(0,command.delta);return 'scrolled';}
  if(command.cmd==='viewport'){await page.setViewportSize({width:command.width,height:command.height});return 'resized';}
  if(command.cmd==='screenshot'){const path=resolve(state,'session/browser.png');await page.screenshot({path});return {path};}
  if(command.cmd==='goto'){const u=new URL(command.url);if(u.protocol!=='https:'||u.hostname!=='www.flyordie.com')throw new Error('Destino não permitido');await page.goto(u.href,{waitUntil:'domcontentloaded'});return safeUrl(page.url());}
  if(command.cmd==='close'){await context.close();rl.close();return 'closed';}
  throw new Error('Comando inválido');
}
rl.on('line',line=>{queue=queue.then(async()=>{let id;try{const command=JSON.parse(line);id=command.id;console.log(JSON.stringify({id,result:await dispatch(command)}));}catch(error){console.log(JSON.stringify({id,error:error.message.split('\n')[0]}));}});});
context.on('close',()=>{rl.close();process.exitCode=0;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>context.close().finally(()=>process.exit(0)));
