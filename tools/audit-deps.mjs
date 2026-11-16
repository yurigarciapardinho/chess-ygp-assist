import { spawnSync } from 'node:child_process';
import { dirname, resolve, delimiter } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
const npm=resolve(dirname(process.execPath),'../lib/node_modules/npm/bin/npm-cli.js');
const result=spawnSync(process.execPath,[npm,'audit','--json','--audit-level=low'],{encoding:'utf8',env:{...process.env,PATH:dirname(process.execPath)+delimiter+(process.env.PATH||'')}});
if(result.error)throw result.error;
await mkdir('artifacts',{recursive:true});
await writeFile('artifacts/npm-audit.json',result.stdout);
let report;
try{report=JSON.parse(result.stdout);}catch{console.error(result.stderr||'npm audit não retornou JSON');process.exit(1);}
console.log(JSON.stringify({checkedAt:new Date().toISOString(),vulnerabilities:report.metadata?.vulnerabilities,dependencies:report.metadata?.dependencies}));
process.exitCode=result.status||0;
