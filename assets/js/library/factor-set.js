const FACTOR_SET_SCHEMA_VERSION = 2;
const FACTOR_SET_SLOTS = Object.freeze([
  { key: "parentA", label: "親A" }, { key: "grandparentA1", label: "祖A-1" }, { key: "grandparentA2", label: "祖A-2" },
  { key: "parentB", label: "親B" }, { key: "grandparentB1", label: "祖B-1" }, { key: "grandparentB2", label: "祖B-2" }
]);
function emptySlots(){ return Object.fromEntries(FACTOR_SET_SLOTS.map(({key})=>[key,null])); }
function characterIdOf(entry){ return entry?.characterId ?? entry?.character?.characterId ?? null; }
function validateFactorSetDraft(slots, entriesById, trainee=null){
  const errors=[]; const selected=[];
  FACTOR_SET_SLOTS.forEach(({key,label})=>{ const id=slots?.[key]??null; if(!id)return; const entry=entriesById.get(id); if(!entry) errors.push(`${label}の保存データが見つかりません`); else selected.push({key,label,entry,characterId:characterIdOf(entry)}); });
  const byKey=new Map(selected.map(x=>[x.key,x]));
  const same=(a,b)=>a?.characterId&&b?.characterId&&a.characterId===b.characterId;
  const pairs=[
    ["parentA","parentB","親Aと親Bに同じウマ娘は設定できません"],
    ["parentA","grandparentA1","親Aと祖A-1に同じウマ娘は設定できません"],
    ["parentA","grandparentA2","親Aと祖A-2に同じウマ娘は設定できません"],
    ["parentB","grandparentB1","親Bと祖B-1に同じウマ娘は設定できません"],
    ["parentB","grandparentB2","親Bと祖B-2に同じウマ娘は設定できません"],
    ["grandparentA1","grandparentA2","祖A-1と祖A-2に同じウマ娘は設定できません"],
    ["grandparentB1","grandparentB2","祖B-1と祖B-2に同じウマ娘は設定できません"]
  ];
  pairs.forEach(([a,b,msg])=>{if(same(byKey.get(a),byKey.get(b)))errors.push(msg);});
  if(trainee?.characterId){
    if(trainee.characterId===byKey.get("parentA")?.characterId) errors.push("育成ウマ娘と親Aに同じウマ娘は設定できません");
    if(trainee.characterId===byKey.get("parentB")?.characterId) errors.push("育成ウマ娘と親Bに同じウマ娘は設定できません");
  }
  return { valid:errors.length===0, errors, selectedCount:selected.length };
}
function createFactorSet({id,name="",slots,entriesById,trainee=null,createdAt=null,now=new Date().toISOString()}){
  const cleanName=String(name||"").trim(); if(!cleanName) throw new Error("編成名は必須です");
  const result=validateFactorSetDraft(slots,entriesById,trainee); if(!result.valid) throw new Error(result.errors.join(" / "));
  if(result.selectedCount===0) throw new Error("1枠以上選択してください");
  return { id, name:cleanName, trainee:trainee?{...trainee}:null, slots:{...emptySlots(),...slots}, schemaVersion:FACTOR_SET_SCHEMA_VERSION, createdAt:createdAt||now, updatedAt:now };
}
export { FACTOR_SET_SCHEMA_VERSION, FACTOR_SET_SLOTS, emptySlots, validateFactorSetDraft, createFactorSet };
