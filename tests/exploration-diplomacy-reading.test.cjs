const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const assert=require('node:assert/strict');
const test=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
function load(record){
  const ctx={cachedArgoRecord:record,isPlainObject:x=>!!x&&typeof x==='object'&&!Array.isArray(x)};
  const fn=source.match(/^    function diplomacyValue\([^]*?^    }/m)[0];
  vm.createContext(ctx);vm.runInContext(fn,ctx);return ctx.diplomacyValue;
}
test('Vanguard reads its recorded cycle field rather than requesting another choice',()=>{
  const read=load({diplomacy:{'c5-outcastVanguard':'-4','c5-cycladeanProtectorate':'-2'}});
  assert.equal(read('c5','outcastVanguard'),-4);
  assert.equal(read('c5','cycladeanProtectorate'),-2);
});
test('Vanguard accepts documented short and official legacy spellings',()=>{
  for(const key of ['c5-vanguard','c5-f_vanguard','c5-OUTCASTVANGUARD','c5-outcast-vanguard']){
    assert.equal(load({diplomacy:{[key]:'3'}})('c5','outcastVanguard'),3,key);
  }
});
test('an explicit blank, zero and missing faction stay distinct',()=>{
  assert.equal(load({diplomacy:{'c5-outcastVanguard':'','vanguard':'3'}})('c5','outcastVanguard'),null);
  assert.equal(load({diplomacy:{'c5-OUTCAST-VANGUARD':'3','c5-outcastVanguard':''}})('c5','outcastVanguard'),null);
  assert.equal(load({diplomacy:{'c5-outcastVanguard':'0'}})('c5','outcastVanguard'),0);
  assert.equal(load({diplomacy:{'c5-cycladeanProtectorate':'-4','c4-outcastVanguard':'6'}})('c5','outcastVanguard'),null);
});
test('a fresh record supplied during settlement overrides the cached record',()=>{
  const read=load({diplomacy:{'c5-outcastVanguard':'8'}});
  assert.equal(read('c5','outcastVanguard',{diplomacy:{'c5-outcastVanguard':'-2'}}),-2);
});
