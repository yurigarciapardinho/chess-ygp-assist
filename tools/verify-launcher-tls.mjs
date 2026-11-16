import { Camoufox } from 'camoufox';
import { createServer } from 'node:https';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { navigateAtStartup } from './startup-navigation.mjs';

// A temporary local CA/certificate must remain untrusted. No login profile,
// external site or system trust store is used by this regression.
const work=await mkdtemp(join(tmpdir(),'chess-launcher-tls-'));
let browser,server;
try {
 const key=join(work,'key.pem'),cert=join(work,'cert.pem');
 const generated=spawnSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1','-keyout',key,'-out',cert],{encoding:'utf8'});
 if(generated.error||generated.status!==0)throw new Error('Este teste requer OpenSSL no PATH.');
 let requests=0;
 server=createServer({key:await readFile(key),cert:await readFile(cert)},(_,response)=>{requests++;response.end('This must not be fetched.');});
 server.on('tlsClientError',()=>{});
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 browser=await Camoufox({browser:'158.0.1-beta.41',headless:true,os:'linux'});
 const context=await browser.newContext({ignoreHTTPSErrors:false});
 const page=await context.newPage();const notices=[];
 const ready=await navigateAtStartup(()=>page.goto('https://127.0.0.1:'+server.address().port,{timeout:15000}),message=>notices.push(message));
 assert.equal(ready,false);
 assert.equal(notices.length,1);
 assert.equal(requests,0,'untrusted HTTPS must not deliver an HTTP request');
 assert.equal(page.isClosed(),false,'the certificate warning window remains available');
 console.log(JSON.stringify({tls:'PASS',untrustedCertificateRejected:true,httpRequests:requests,browserRemainsOpen:true}));
}finally{
 await browser?.close();
 if(server)await new Promise(resolve=>server.close(resolve));
 await rm(work,{recursive:true,force:true});
}
