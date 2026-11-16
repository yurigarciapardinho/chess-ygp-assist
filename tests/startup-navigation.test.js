import test from 'node:test';
import assert from 'node:assert/strict';
import { navigateAtStartup } from '../tools/startup-navigation.mjs';

test('successful navigation reports readiness without a certificate warning',async()=>{
 let calls=0;
 assert.equal(await navigateAtStartup(async()=>{calls++;},()=>assert.fail('unexpected warning')),true);
 assert.equal(calls,1);
});

test('certificate refusal does not retry or report a ready session',async()=>{
 for(const code of ['SEC_ERROR_UNKNOWN_ISSUER','MOZILLA_PKIX_ERROR_MITM_DETECTED','SSL_ERROR_BAD_CERT_DOMAIN','SSL_ERROR_UNKNOWN']){
  let calls=0;const notices=[];
  assert.equal(await navigateAtStartup(async()=>{calls++;throw new Error('page.goto: '+code);},message=>notices.push(message)),false);
  assert.equal(calls,1);
  assert.equal(notices.length,1);
  assert.ok(notices[0].includes(code));
 }
});

test('timeouts and other navigation failures are not mistaken for certificate errors',async()=>{
 const failure=new Error('page.goto: Timeout 60000ms exceeded.');
 await assert.rejects(navigateAtStartup(async()=>{throw failure;},()=>assert.fail('unexpected certificate warning')),error=>error===failure);
});
