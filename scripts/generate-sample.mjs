import fs from 'node:fs';
import path from 'node:path';

const countries = [
  ['JPN','Japan','392'],['USA','United States','840'],['CHN','China','156'],['GBR','United Kingdom','826'],['FRA','France','250'],
  ['DEU','Germany','276'],['ITA','Italy','380'],['ESP','Spain','724'],['CAN','Canada','124'],['MEX','Mexico','484'],
  ['BRA','Brazil','076'],['ARG','Argentina','032'],['AUS','Australia','036'],['IND','India','356'],['IDN','Indonesia','360'],
  ['KOR','South Korea','410'],['THA','Thailand','764'],['ZAF','South Africa','710'],['EGY','Egypt','818'],['TUR','Turkey','792']
];
const entities = ['Atlas','Nova','Orion','Zenith'];
const winnerFor = (year, i) => {
  if (year < 2003) return i < 11 ? 'Atlas' : i < 16 ? 'Nova' : 'Orion';
  if (year < 2006) return [0,2,13,14].includes(i) ? 'Zenith' : (i < 9 || [11,12,15].includes(i)) ? 'Nova' : i < 15 ? 'Atlas' : 'Orion';
  if (year < 2009) return (i < 10 || [13,14,15,18].includes(i)) ? 'Nova' : [10,11,12,16].includes(i) ? 'Zenith' : 'Orion';
  return [3,4,5,6,7,10,11,16,17,19].includes(i) ? 'Orion' : [0,1,2,8,9,13].includes(i) ? 'Nova' : 'Zenith';
};
const lines = ['year,country_code,country_name,numeric_code,entity,value'];
for (let year = 2000; year <= 2010; year++) {
  countries.forEach(([code,name,numeric], i) => {
    const winner = winnerFor(year, i);
    entities.forEach((entity, e) => lines.push([year,code,name,numeric,entity,entity === winner ? 55 + ((year+i)%10) : 15 + ((year+i+e*3)%15)].join(',')));
  });
}
fs.writeFileSync(path.join(process.cwd(),'public/data/sample.csv'), lines.join('\n') + '\n');
console.log(`Generated ${lines.length - 1} sample rows.`);
