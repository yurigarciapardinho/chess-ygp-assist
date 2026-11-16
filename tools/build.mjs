import { build } from 'esbuild';
import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
await mkdir(resolve(root,'dist'),{recursive:true});
const manifest=JSON.parse(await readFile(resolve(root,'src/engine/manifest.json'),'utf8'));
const assets={};
for(const [key,file] of [['js','stockfish-19-lite-single.js'],['wasm','stockfish-19-lite-single.wasm']]){
 const bytes=await readFile(resolve(root,'node_modules/stockfish/bin',file));
 if(bytes.length!==manifest[key].bytes||createHash('sha256').update(bytes).digest('hex')!==manifest[key].sha256)throw new Error('Integrity mismatch: '+file);
 assets[key]=bytes.toString('base64');
}
const embedded={name:'verified-engine-assets',setup(builder){
 builder.onResolve({filter:/^ygp:engine-assets$/},()=>({path:'engine',namespace:'ygp-assets'}));
 builder.onLoad({filter:/.*/,namespace:'ygp-assets'},()=>({contents:'export const engineAssets = Object.freeze('+JSON.stringify(assets)+');',loader:'js'}));
}};
const result=await build({entryPoints:[resolve(root,'src/entries/desktop.js')],bundle:true,write:false,format:'iife',target:['firefox140','chrome120','safari17'],loader:{'.css':'text'},plugins:[embedded],legalComments:'inline',minify:false});
const banner='// Chess YGP Assist 0.1.0-alpha.1 — FlyOrDie adaptation\n// Original Chess Assist: ThatKidGlitchy — https://github.com/ThatKidGlitchy/chess-hacks\n';
const code=banner+result.outputFiles[0].text;
for(const mobile of [false,true]){
 const name=mobile?'chess-assist-mobile.js':'chess-assist.js';
 const userscript=mobile?'chess-assist-tampermonkey-mobile.js':'chess-assist-tampermonkey.js';
 const header=['// ==UserScript==','// @name Chess YGP Assist'+(mobile?' Mobile':''),'// @namespace chess-ygp-assist/flyordie','// @version 0.1.0-alpha.1','// @description FlyOrDie chess analysis with an isolated interface and verified Stockfish assets','// @match https://www.flyordie.com/*','// @grant none','// @run-at document-start','// ==/UserScript==',''].join('\n');
 await writeFile(resolve(root,'dist',name),code);
 await writeFile(resolve(root,'dist',userscript),header+code);
 if(process.argv.includes('--publish-local'))for(const file of [name,userscript])await copyFile(resolve(root,'dist',file),resolve(root,file));
}
await mkdir(resolve(root,'dist/licenses'),{recursive:true});
for(const [from,to] of [['node_modules/stockfish/Copying.txt','dist/licenses/Stockfish-GPL-3.0.txt'],['node_modules/chess.js/LICENSE','dist/licenses/chess.js-BSD-2-Clause.txt']]){
 const text=await readFile(resolve(root,from),'utf8');
 await writeFile(resolve(root,to),text.replace(/\r\n?/g,'\n'));
}
console.log(JSON.stringify({build:'ok',bytes:Buffer.byteLength(code),outputs:4,publishedLocal:process.argv.includes('--publish-local')}));
