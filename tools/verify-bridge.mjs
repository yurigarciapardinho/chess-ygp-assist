import { Camoufox } from 'camoufox';
import { registerBridge } from './control-bridge.mjs';
import assert from 'node:assert/strict';
const browser=await Camoufox({browser:'158.0.1-beta.41',headless:true,os:'linux',main_world_eval:true});
try{
 const context=await browser.newContext();
 await context.exposeBinding('__YGPRequest',async(source,request)=>({type:request.type,reply:'bridge-ok'}));
 await registerBridge(context);
 await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><title>Local bridge fixture</title>'}));
 const page=await context.newPage();
 await page.goto('https://www.flyordie.com/chess');
 const timeout=new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Bridge did not respond')),5000);timer.unref();});
 const result=await Promise.race([page.evaluate('mw:window.__YGPRequest({type:"harvest"})'),timeout]);
 assert.deepEqual(result,{type:'harvest',reply:'bridge-ok'});
 console.log(JSON.stringify({bridge:'PASS',transport:'document-scoped JSON CustomEvents',result}));
}finally{await browser.close();}
