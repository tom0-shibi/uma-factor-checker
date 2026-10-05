import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHARACTER_CSV = path.join(ROOT, "data/character-master/character-master.csv");
const VARIANT_CSV = path.join(ROOT, "data/character-master/character-variant-master.csv");
const OUTPUT = path.join(ROOT, "assets/js/data/character-master.js");
function parseCsvLine(line) {
  const out=[]; let cur=""; let quoted=false;
  for(let i=0;i<line.length;i++){const ch=line[i]; if(ch==='"'){if(quoted&&line[i+1]==='"'){cur+='"';i++;}else quoted=!quoted;}else if(ch===','&&!quoted){out.push(cur);cur="";}else cur+=ch;} out.push(cur); return out;
}
function readCsv(file){const text=fs.readFileSync(file,"utf8").replace(/^\uFEFF/,"").trimEnd(); const [header,...lines]=text.split(/\r?\n/).map(parseCsvLine); return lines.map(values=>Object.fromEntries(header.map((key,i)=>[key,values[i]??""])));}
function build(){
  const characters=readCsv(CHARACTER_CSV).map(row=>({characterId:row.characterId,name:row["ウマ娘名"]}));
  const variants=readCsv(VARIANT_CSV).map(row=>({variantId:row.variantId,characterId:row.characterId,characterName:characters.find(x=>x.characterId===row.characterId)?.name??"",variantName:row["衣装名"],displayName:row["育成ウマ娘名"],initialRarity:Number(row["入手時★"]),releaseDate:row["実装日"],aliases:row["通称"]?row["通称"].split("、").map(x=>x.trim()).filter(Boolean):[],isInitialVariant:row["初期衣装"]==="1",searchText:[row["育成ウマ娘名"],characters.find(x=>x.characterId===row.characterId)?.name??"",row["衣装名"],row["通称"]].join(" ")}));
  const module=`// Generated from data/character-master/*.csv. Do not edit manually.\nexport const CHARACTER_MASTER_VERSION = "2026-10-05";\nexport const CHARACTER_MASTER = ${JSON.stringify(characters)};\nexport const CHARACTER_VARIANT_MASTER = ${JSON.stringify(variants)};\n\nconst normalizeSearch = value => String(value ?? "").normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)).replace(/\\s+/g, "");\nexport function searchCharacterVariants(query, limit = 30) {\n  const q = normalizeSearch(query);\n  if (!q) return CHARACTER_VARIANT_MASTER.slice(0, limit);\n  return CHARACTER_VARIANT_MASTER.filter(item => normalizeSearch(item.searchText).includes(q)).slice(0, limit);\n}\nexport function getCharacterVariant(variantId) { return CHARACTER_VARIANT_MASTER.find(item => item.variantId === variantId) ?? null; }\nexport function getCharacter(characterId) { return CHARACTER_MASTER.find(item => item.characterId === characterId) ?? null; }\n`;
  fs.writeFileSync(OUTPUT,module,"utf8"); console.log(`Character Masterを生成しました: ${characters.length} characters / ${variants.length} variants`);
}
if (process.argv[1]===fileURLToPath(import.meta.url)) build();
export { build };
