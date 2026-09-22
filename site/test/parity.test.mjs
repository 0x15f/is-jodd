import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyInteger } from '../public/parity.mjs';
test('classifies signed integers and normalizes decimal notation without Number rounding',()=>{
 for(const [input,odd,normalized] of [['0',false,'0'],['-0',false,'0'],['+0007',true,'7'],['-17',true,'-17'],[' 42 ',false,'42'],['9007199254740993',true,'9007199254740993'],['-9007199254740994',false,'-9007199254740994']]){
  const r=classifyInteger(input);assert.equal(r.valid,true);assert.equal(r.odd,odd);assert.equal(r.normalized,normalized);
  assert.equal(BigInt(r.quotient)*2n+BigInt(r.remainder),BigInt(normalized));
 }
});
test('rejects non-integer notation and excessive inputs',()=>{
 for(const input of ['', ' ', '2.0','1.5','1e3','1,000','0xff','--3','NaN','Infinity','3x','9'.repeat(1001), '0'.repeat(1001), '-'+'1'.repeat(1000)+'2'])assert.equal(classifyInteger(input).valid,false,input.slice(0,20));
 const r=classifyInteger('-'+'9'.repeat(1000));assert.equal(r.valid,true);assert.equal(r.odd,true);
});
