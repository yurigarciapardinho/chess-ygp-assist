import { Camoufox } from 'camoufox';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, mkdtemp, rm, copyFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import { registerControls, harvest } from './browser-control.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(root,'.github');
const check=spawnSync('ffmpeg',['-version'],{stdio:'ignore'});
if(check.status!==0)throw new Error('Instale FFmpeg e disponibilize ffmpeg no PATH antes de executar docs:media.');
const bundle=await readFile(resolve(root,'dist/chess-assist.js'),'utf8');
const core=(await build({stdin:{contents:"import { Chess } from 'chess.js';window.FixtureChess=Chess;",resolveDir:root},bundle:true,write:false,format:'iife'})).outputFiles[0].text;
let inner=await readFile(resolve(root,'tests/fixtures/native-frame.html'),'utf8');
const panelSource=await readFile(resolve(root,'src/ui/panel.js'),'utf8');
const shapes=runInNewContext('('+panelSource.match(/const shapes = (\{[\s\S]*?\n\});/)[1]+')');
const pieces=Array.from({length:12},(_,row)=>{
 const color=row<6?'#fffbed':'#26312c',stroke=row<6?'#26331e':'#c0cbb4';
 return '<g transform="translate(0 '+row*96+') scale(3)" fill="'+color+'" stroke="'+stroke+'" stroke-width="1.3" stroke-linejoin="round">'+shapes['pnbrqk'[row%6]]+'<path d="M8 28h16" fill="none"/></g>';
}).join('');
const svg='<svg xmlns="http://www.w3.org/2000/svg" width="480" height="1152">'+pieces+'</svg>';
inner=inner.replace(/^atlas.src=.*$/m,'atlas.src='+JSON.stringify('data:image/svg+xml,'+encodeURIComponent(svg))+';');
inner=inner.replace("PLAYER:'Fixture Player'","PLAYER:'Demo Player'").replaceAll("'Fixture Player'","'Demo Player'");
inner=inner.replace('width:692px;height:480px','width:840px;height:582px');
const outer='<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Chess YGP Assist · Demo</title><style>body{margin:0;background:#10181d;color:#eef4e7;font:16px system-ui}header{padding:22px 28px;border-bottom:1px solid #344a40}h1{margin:0;font-size:25px}p{margin:8px 0;color:#b7cbb9}iframe{position:absolute;left:16px;top:132px;width:840px;height:582px;border:0;border-radius:12px}footer{position:absolute;bottom:20px;left:28px;color:#a8b9b2;font-size:13px}</style><header><h1>Chess YGP Assist</h1><p>Stockfish WASM · Canvas + Firefox · Demonstração local</p></header><iframe src="/games/webapp/x.html"></iframe><footer>Fixture de apresentação • Dados fictícios • Nenhuma sessão de login</footer></html>';
const work=await mkdtemp(join(tmpdir(),'chess-docs-media-'));
let browser;const frames=[],errors=[],requests=[];
const report={viewport:{width:1280,height:800},environment:'isolated routed fixture; real engine and UI; no login profile',status:'FAIL'};
try{
 await mkdir(out,{recursive:true});
 browser=await Camoufox({browser:'158.0.1-beta.41',headless:true,os:'linux',main_world_eval:true});
 const context=await browser.newContext({viewport:report.viewport});
 await registerControls(context);await context.addInitScript('mw:'+bundle);
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());requests.push(u.origin+u.pathname);
  const body=u.pathname==='/chess'?outer:u.pathname==='/games/webapp/x.html'?inner:u.pathname==='/chess-core.js'?core:null;
  await route.fulfill({status:body?200:404,contentType:u.pathname.endsWith('.js')?'application/javascript':'text/html',body:body||''});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 const wait=async(fn,label)=>{const end=Date.now()+30000;while(Date.now()<end){if(await fn())return;await new Promise(r=>setTimeout(r,50));}throw new Error('Timeout: '+label);};
 await page.goto('https://www.flyordie.com/chess',{waitUntil:'load'});
 await wait(()=>page.evaluate('mw:!!window.YGPAssist?.diagnostics()?.point'),'board capture');
 await page.evaluate('mw:(()=>{const s=document.querySelector("ygp-assist-root").shadowRoot;const a=s.querySelector(".auto");a.checked=false;a.dispatchEvent(new Event("input"));const d=s.querySelector(".depth");d.value=10;d.dispatchEvent(new Event("input"));})()');
 const frame=page.frames().find(f=>f.url().includes('/games/webapp/x.html'));
 async function shot(name){await page.screenshot({path:resolve(out,name)});}
 async function keyframe(seconds=1){const name=String(frames.length).padStart(3,'0')+'.png';await page.screenshot({path:join(work,name)});frames.push({name,seconds});}
 await shot('screenshot-sync.png');await keyframe(1.2);
 await harvest(page,page.mainFrame());
 assert.equal(await page.evaluate('mw:YGPAssist.getSnapshot().fen'),await frame.evaluate('mw:fixture.fen()'));
 await page.evaluate('mw:window.__docsAnalysis=YGPAssist.analyse();true');
 await keyframe(.7);
 await page.evaluate('mw:window.__docsAnalysis');
 await wait(()=>page.evaluate('mw:!!document.querySelector("ygp-assist-root").shadowRoot.querySelector(".layer polygon")'),'best move arrow');
 await shot('screenshot-gameplay.png');await copyFile(resolve(out,'screenshot-gameplay.png'),resolve(out,'screenshot-panel.png'));
 await keyframe(1.5);
 const plies=await frame.evaluate('mw:fixture.plies()');
 await page.locator('ygp-assist-root .play').click();
 await wait(async()=>await frame.evaluate('mw:fixture.plies()')===plies+1,'assisted mouse move');
 await keyframe(.8);
 await page.evaluate('mw:window.__docsAnalysis=YGPAssist.analyse();true');await keyframe(.6);await page.evaluate('mw:window.__docsAnalysis');await keyframe(1.5);
 // Drive import using the same controls exposed to the user.
 await page.locator('ygp-assist-root summary').click();
 const fen='rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
 await page.locator('ygp-assist-root textarea').fill(fen);
 await page.locator('ygp-assist-root .import').click();
 const result=await page.evaluate('mw:YGPAssist.analyse()');assert.ok(result.move);
 await shot('screenshot-fen.png');
 assert.deepEqual(errors,[]);assert.ok(requests.every(u=>u.startsWith('https://www.flyordie.com/')));
 const concat=frames.map(f=>"file '"+f.name+"'\nduration "+f.seconds).join('\n')+"\nfile '"+frames.at(-1).name+"'\n";
 await writeFile(join(work,'frames.txt'),concat);
 const gif=spawnSync('ffmpeg',['-y','-loglevel','error','-f','concat','-safe','0','-i',join(work,'frames.txt'),'-filter_complex','fps=8,scale=960:-1:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse','-loop','0',resolve(out,'demo-gameplay.gif')],{encoding:'utf8'});
 if(gif.status!==0)throw new Error('FFmpeg: '+gif.stderr);
 for(const name of ['screenshot-gameplay.png','screenshot-panel.png','screenshot-sync.png','screenshot-fen.png']){
  const data=await readFile(resolve(out,name));assert.equal(data.readUInt32BE(16),1280);assert.equal(data.readUInt32BE(20),800);
 }
 const gifData=await readFile(resolve(out,'demo-gameplay.gif'));assert.equal(gifData.subarray(0,3).toString(),'GIF');assert.ok(gifData.length>10000);
 report.status='PASS';report.frames=frames;report.mouseMoveConfirmed=true;report.arrowConfirmed=true;report.files=['screenshot-gameplay.png','screenshot-panel.png','screenshot-sync.png','screenshot-fen.png','demo-gameplay.gif'];report.gifBytes=gifData.length;
} catch(error){report.error=error.message;process.exitCode=1;}
finally{await browser?.close();await rm(work,{recursive:true,force:true});await mkdir(resolve(root,'artifacts'),{recursive:true});await writeFile(resolve(root,'artifacts/media-report.json'),JSON.stringify({...report,pageErrors:errors},null,2)+'\n');console.log(JSON.stringify(report,null,2));}
