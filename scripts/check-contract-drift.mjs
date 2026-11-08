import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import openapiTS, {astToString,COMMENT_HEADER} from 'openapi-typescript';

// Generate in memory: never overwrite a user's edited generated file.
const schema=new URL('../packages/contracts/openapi/openapi.v1.yaml',import.meta.url);
const generated=COMMENT_HEADER+astToString(await openapiTS(schema));
const existing=await readFile(new URL('../packages/contracts/generated/openapi.d.ts',import.meta.url),'utf8');
assert.ok(existing.replaceAll('\r\n','\n')===generated.replaceAll('\r\n','\n'),'Generated contract drift; review changes before regenerating');
console.log('Generated contract matches current schema; no files written.');
