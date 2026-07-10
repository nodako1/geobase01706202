import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';
import {z} from 'zod';

const root = process.cwd();
const dir = path.join(root,'public','data');
const configSchema = z.object({
  title:z.string().min(1), subtitle:z.string(), startYear:z.number().int(), endYear:z.number().int(), secondsPerYear:z.number().positive(),
  introSeconds:z.number().nonnegative(), outroSeconds:z.number().nonnegative(), transitionRatio:z.number().min(.05).max(1),
  outputWidth:z.number().int().positive(), outputHeight:z.number().int().positive(), fps:z.union([z.literal(30),z.literal(60)]),
  rankingSize:z.number().int().min(1).max(10), noDataColor:z.string(), backgroundColor:z.string(), showEvents:z.boolean(), showDelta:z.boolean()
}).refine(v=>v.startYear<=v.endYear);
const entitySchema = z.record(z.string(),z.object({displayName:z.string(),color:z.string(),priority:z.number().int()}));
const readJson = f => JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
const readCsv = f => {
  const result = Papa.parse(fs.readFileSync(path.join(dir,f),'utf8'),{header:true,skipEmptyLines:true,transformHeader:h=>h.trim()});
  if(result.errors.length) throw new Error(result.errors.map(e=>e.message).join(', '));
  return result.data;
};
const config = configSchema.parse(readJson('config.json'));
const entities = entitySchema.parse(readJson('entities.json'));
const rows = readCsv('sample.csv').map((r,i)=>{
  const year=Number(r.year), value=Number(r.value), entity=String(r.entity).trim();
  if(!Number.isInteger(year)||!Number.isFinite(value)||!entities[entity]) throw new Error(`Invalid sample.csv row ${i+2}`);
  return {year,countryCode:String(r.country_code).trim(),countryName:String(r.country_name).trim(),numericCode:String(r.numeric_code).padStart(3,'0'),entity,value};
});
const eventRows = fs.existsSync(path.join(dir,'events.csv')) ? readCsv('events.csv') : [];
const events = new Map();
for(const r of eventRows){const year=Number(r.year), list=events.get(year)??[];list.push({year,title:r.title,description:r.description});events.set(year,list);}
const grouped = new Map();
for(const row of rows){const key=`${row.year}:${row.countryCode}`, list=grouped.get(key)??[];list.push(row);grouped.set(key,list);}
let previousByCountry=new Map(), previousCounts=new Map(), previousLeader=null;
const years=[];
for(let year=config.startYear;year<=config.endYear;year++){
  const winners=[];
  for(const [key,candidates] of grouped){if(!key.startsWith(`${year}:`)) continue;candidates.sort((a,b)=>b.value-a.value||entities[a.entity].priority-entities[b.entity].priority);winners.push(candidates[0]);}
  const countries=winners.map(w=>({...w,previousEntity:previousByCountry.get(w.countryCode)??null,changed:previousByCountry.has(w.countryCode)&&previousByCountry.get(w.countryCode)!==w.entity}));
  const counts=new Map(Object.keys(entities).map(e=>[e,0])); for(const c of countries) counts.set(c.entity,(counts.get(c.entity)??0)+1);
  const ranking=[...counts].map(([entity,count])=>({entity,count,delta:count-(previousCounts.get(entity)??0),priority:entities[entity].priority})).sort((a,b)=>b.count-a.count||a.priority-b.priority).map((r,i)=>({entity:r.entity,count:r.count,delta:r.delta,rank:i+1}));
  const leader=ranking[0]?.count?ranking[0].entity:null;
  years.push({year,countries,ranking,leader,previousLeader,leaderChanged:previousLeader!==null&&leader!==previousLeader,gainedByEntity:{},lostByEntity:{},events:events.get(year)??[]});
  previousByCountry=new Map(countries.map(c=>[c.countryCode,c.entity])); previousCounts=counts; previousLeader=leader;
}
const output={config,entities,years,warnings:[],generatedAt:new Date().toISOString()};
fs.mkdirSync(path.join(root,'src','generated'),{recursive:true});
fs.writeFileSync(path.join(root,'src','generated','video-data.json'),JSON.stringify(output,null,2)+'\n');
console.log(`Prepared ${years.length} years and ${rows.length} rows.`);
