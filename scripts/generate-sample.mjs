import fs from 'node:fs';
import path from 'node:path';

const ENTITIES = [
  'Germany',
  'Japan',
  'Italy',
  'Soviet Union',
  'United Kingdom',
  'United States',
  'France',
  'Other'
];

const countries = [
  ['DEU','Germany','276',357,'Germany'],['AUT','Austria','040',84,'Germany'],['CZE','Czechia','203',79,'Germany'],
  ['JPN','Japan','392',378,'Japan'],['KOR','South Korea','410',100,'Japan'],['PRK','North Korea','408',121,'Japan'],['TWN','Taiwan','158',36,'Japan'],
  ['ITA','Italy','380',301,'Italy'],['ALB','Albania','008',29,'Italy'],['LBY','Libya','434',1760,'Italy'],['ETH','Ethiopia','231',1104,'Italy'],['ERI','Eritrea','232',118,'Italy'],['SOM','Somalia','706',638,'Italy'],
  ['RUS','Russia','643',17098,'Soviet Union'],['UKR','Ukraine','804',604,'Soviet Union'],['BLR','Belarus','112',208,'Soviet Union'],
  ['KAZ','Kazakhstan','398',2725,'Soviet Union'],['UZB','Uzbekistan','860',448,'Soviet Union'],['TKM','Turkmenistan','795',488,'Soviet Union'],['KGZ','Kyrgyzstan','417',200,'Soviet Union'],['TJK','Tajikistan','762',143,'Soviet Union'],['ARM','Armenia','051',30,'Soviet Union'],['AZE','Azerbaijan','031',87,'Soviet Union'],['GEO','Georgia','268',70,'Soviet Union'],
  ['GBR','United Kingdom','826',244,'United Kingdom'],['CAN','Canada','124',9985,'United Kingdom'],['AUS','Australia','036',7692,'United Kingdom'],['NZL','New Zealand','554',268,'United Kingdom'],
  ['IND','India','356',3287,'United Kingdom'],['PAK','Pakistan','586',881,'United Kingdom'],['BGD','Bangladesh','050',148,'United Kingdom'],
  ['MMR','Myanmar','104',677,'United Kingdom'],['MYS','Malaysia','458',330,'United Kingdom'],['SGP','Singapore','702',1,'United Kingdom'],
  ['EGY','Egypt','818',1001,'United Kingdom'],['SDN','Sudan','729',1886,'United Kingdom'],['KEN','Kenya','404',580,'United Kingdom'],['UGA','Uganda','800',242,'United Kingdom'],['TZA','Tanzania','834',947,'United Kingdom'],['ZAF','South Africa','710',1221,'United Kingdom'],['IRQ','Iraq','368',438,'United Kingdom'],['JOR','Jordan','400',89,'United Kingdom'],['PNG','Papua New Guinea','598',463,'United Kingdom'],
  ['USA','United States','840',9834,'United States'],['PHL','Philippines','608',300,'United States'],
  ['FRA','France','250',552,'France'],['DZA','Algeria','012',2382,'France'],['MAR','Morocco','504',447,'France'],['TUN','Tunisia','788',164,'France'],
  ['VNM','Vietnam','704',331,'France'],['LAO','Laos','418',237,'France'],['KHM','Cambodia','116',181,'France'],['SYR','Syria','760',185,'France'],['LBN','Lebanon','422',10,'France'],
  ['SEN','Senegal','686',197,'France'],['MLI','Mali','466',1240,'France'],['NER','Niger','562',1267,'France'],['TCD','Chad','148',1284,'France'],['CIV','Ivory Coast','384',322,'France'],['BFA','Burkina Faso','854',274,'France'],['BEN','Benin','204',115,'France'],['GIN','Guinea','324',246,'France'],['MRT','Mauritania','478',1030,'France'],['CAF','Central African Republic','140',623,'France'],['COG','Republic of the Congo','178',342,'France'],['GAB','Gabon','266',268,'France'],['MDG','Madagascar','450',587,'France'],
  ['POL','Poland','616',313,'Other'],['DNK','Denmark','208',43,'Other'],['NOR','Norway','578',385,'Other'],['NLD','Netherlands','528',42,'Other'],['BEL','Belgium','056',31,'Other'],['LUX','Luxembourg','442',3,'Other'],
  ['SVK','Slovakia','703',49,'Other'],['HUN','Hungary','348',93,'Other'],['ROU','Romania','642',238,'Other'],['BGR','Bulgaria','100',111,'Other'],['GRC','Greece','300',132,'Other'],
  ['SVN','Slovenia','705',20,'Other'],['HRV','Croatia','191',57,'Other'],['BIH','Bosnia and Herzegovina','070',51,'Other'],['SRB','Serbia','688',88,'Other'],['MNE','Montenegro','499',14,'Other'],['MKD','North Macedonia','807',26,'Other'],
  ['EST','Estonia','233',45,'Other'],['LVA','Latvia','428',65,'Other'],['LTU','Lithuania','440',65,'Other'],['MDA','Moldova','498',34,'Other'],['FIN','Finland','246',338,'Other'],
  ['ESP','Spain','724',506,'Other'],['PRT','Portugal','620',92,'Other'],['SWE','Sweden','752',450,'Other'],['CHE','Switzerland','756',41,'Other'],['IRL','Ireland','372',70,'Other'],['TUR','Turkey','792',783,'Other'],
  ['CHN','China','156',9597,'Other'],['MNG','Mongolia','496',1564,'Other'],['THA','Thailand','764',513,'Other'],['IDN','Indonesia','360',1905,'Other'],
  ['IRN','Iran','364',1648,'Other'],['AFG','Afghanistan','004',652,'Other'],['NPL','Nepal','524',147,'Other'],
  ['BRA','Brazil','076',8516,'Other'],['ARG','Argentina','032',2780,'Other'],['CHL','Chile','152',756,'Other'],['MEX','Mexico','484',1964,'Other']
];

const trajectory = {
  POL: [['1939-09',{Other:100}],['1939-10',{Germany:55,'Soviet Union':45}],['1941-07',{Germany:100}],['1944-08',{Germany:35,'Soviet Union':65}],['1945-02',{'Soviet Union':100}]],
  DNK: [['1940-03',{Other:100}],['1940-05',{Germany:100}],['1945-05',{'United Kingdom':50,'United States':50}]],
  NOR: [['1940-03',{Other:100}],['1940-06',{Germany:100}],['1945-05',{'United Kingdom':100}]],
  NLD: [['1940-04',{Other:100}],['1940-06',{Germany:100}],['1944-10',{Germany:70,'United Kingdom':20,'United States':10}],['1945-05',{'United Kingdom':50,'United States':50}]],
  BEL: [['1940-04',{Other:100}],['1940-06',{Germany:100}],['1944-09',{'United Kingdom':55,'United States':45}]],
  LUX: [['1940-04',{Other:100}],['1940-06',{Germany:100}],['1944-09',{'United States':100}]],
  FRA: [['1940-04',{France:100}],['1940-07',{Germany:62,France:38}],['1942-12',{Germany:82,France:18}],['1944-06',{Germany:78,France:12,'United Kingdom':5,'United States':5}],['1944-09',{France:45,'United States':35,'United Kingdom':20}],['1945-01',{France:100}]],
  GRC: [['1941-03',{Other:100}],['1941-06',{Germany:65,Italy:35}],['1943-10',{Germany:92,Italy:8}],['1944-11',{'United Kingdom':75,Other:25}]],
  SVN: [['1941-03',{Other:100}],['1941-06',{Germany:55,Italy:45}],['1943-10',{Germany:100}],['1945-05',{'Soviet Union':40,'United Kingdom':20,Other:40}]],
  HRV: [['1941-03',{Other:100}],['1941-06',{Germany:70,Italy:30}],['1943-10',{Germany:100}],['1945-05',{'Soviet Union':35,'United Kingdom':15,Other:50}]],
  BIH: [['1941-03',{Other:100}],['1941-06',{Germany:60,Italy:40}],['1943-10',{Germany:100}],['1945-05',{'Soviet Union':30,'United Kingdom':15,Other:55}]],
  SRB: [['1941-03',{Other:100}],['1941-06',{Germany:85,Italy:15}],['1944-11',{'Soviet Union':65,Other:35}]],
  MNE: [['1941-03',{Other:100}],['1941-06',{Italy:90,Germany:10}],['1943-10',{Germany:100}],['1945-05',{Other:100}]],
  MKD: [['1941-03',{Other:100}],['1941-06',{Germany:70,Italy:30}],['1944-11',{'Soviet Union':40,Other:60}]],
  ALB: [['1939-09',{Italy:100}],['1943-10',{Germany:100}],['1944-12',{Other:100}]],
  HUN: [['1941-06',{Other:100}],['1944-04',{Germany:100}],['1945-02',{'Soviet Union':100}]],
  ROU: [['1941-06',{Other:100}],['1944-09',{'Soviet Union':70,Other:30}],['1945-03',{'Soviet Union':100}]],
  BGR: [['1941-06',{Other:100}],['1944-10',{'Soviet Union':70,Other:30}],['1945-03',{'Soviet Union':100}]],
  FIN: [['1939-11',{Other:100}],['1940-03',{'Soviet Union':12,Other:88}],['1941-07',{Other:100}],['1944-10',{'Soviet Union':10,Other:90}]],
  EST: [['1940-05',{Other:100}],['1940-08',{'Soviet Union':100}],['1941-09',{Germany:100}],['1944-10',{'Soviet Union':100}]],
  LVA: [['1940-05',{Other:100}],['1940-08',{'Soviet Union':100}],['1941-09',{Germany:100}],['1944-10',{'Soviet Union':100}]],
  LTU: [['1940-05',{Other:100}],['1940-08',{'Soviet Union':100}],['1941-08',{Germany:100}],['1944-09',{'Soviet Union':100}]],
  MDA: [['1940-05',{Other:100}],['1940-08',{'Soviet Union':100}],['1941-08',{Germany:80,Italy:20}],['1944-09',{'Soviet Union':100}]],
  UKR: [['1941-05',{'Soviet Union':100}],['1941-11',{Germany:78,'Soviet Union':22}],['1942-11',{Germany:92,'Soviet Union':8}],['1943-11',{Germany:45,'Soviet Union':55}],['1944-10',{'Soviet Union':100}]],
  BLR: [['1941-05',{'Soviet Union':100}],['1941-10',{Germany:94,'Soviet Union':6}],['1943-10',{Germany:85,'Soviet Union':15}],['1944-08',{'Soviet Union':100}]],
  RUS: [['1941-05',{'Soviet Union':100}],['1942-11',{Germany:8,'Soviet Union':92}],['1943-08',{Germany:4,'Soviet Union':96}],['1944-06',{'Soviet Union':100}]],
  GEO: [['1942-07',{'Soviet Union':100}],['1942-11',{Germany:4,'Soviet Union':96}],['1943-03',{'Soviet Union':100}]],
  ITA: [['1943-08',{Italy:100}],['1943-10',{Germany:60,Italy:20,'United Kingdom':10,'United States':10}],['1944-07',{Germany:42,'United States':32,'United Kingdom':26}],['1945-05',{'United States':50,'United Kingdom':50}]],
  DEU: [['1945-01',{Germany:100}],['1945-05',{Germany:30,'United States':30,'United Kingdom':20,'Soviet Union':20}],['1945-07',{'United States':35,'United Kingdom':25,'Soviet Union':40}]],
  AUT: [['1945-01',{Germany:100}],['1945-05',{'United States':30,'United Kingdom':20,'Soviet Union':50}]],
  CZE: [['1945-01',{Germany:100}],['1945-05',{'Soviet Union':80,'United States':20}]],
  LBY: [['1941-12',{Italy:70,Germany:30}],['1942-09',{Italy:55,Germany:45}],['1943-03',{'United Kingdom':65,'United States':35}]],
  EGY: [['1942-05',{'United Kingdom':90,Italy:6,Germany:4}],['1942-09',{'United Kingdom':78,Italy:12,Germany:10}],['1942-12',{'United Kingdom':100}]],
  TUN: [['1942-10',{France:100}],['1942-12',{Germany:55,Italy:45}],['1943-06',{'United Kingdom':55,'United States':45}]],
  DZA: [['1942-10',{France:100}],['1942-12',{'United States':55,'United Kingdom':25,France:20}],['1943-06',{France:55,'United States':30,'United Kingdom':15}]],
  MAR: [['1942-10',{France:100}],['1942-12',{'United States':55,'United Kingdom':20,France:25}],['1943-06',{France:60,'United States':30,'United Kingdom':10}]],
  ETH: [['1941-01',{Italy:100}],['1941-07',{'United Kingdom':90,Other:10}],['1942-01',{Other:100}]],
  ERI: [['1941-01',{Italy:100}],['1941-06',{'United Kingdom':100}]],
  SOM: [['1941-01',{Italy:100}],['1941-06',{'United Kingdom':100}]],
  IRN: [['1941-07',{Other:100}],['1941-10',{'United Kingdom':50,'Soviet Union':50}],['1945-09',{'United Kingdom':35,'Soviet Union':35,Other:30}]],
  IRQ: [['1941-04',{'United Kingdom':100}],['1941-06',{'United Kingdom':100}]],
  SYR: [['1941-05',{France:100}],['1941-08',{'United Kingdom':55,France:45}],['1943-01',{France:70,'United Kingdom':30}]],
  LBN: [['1941-05',{France:100}],['1941-08',{'United Kingdom':55,France:45}],['1943-01',{France:70,'United Kingdom':30}]],
  MDG: [['1942-04',{France:100}],['1942-12',{'United Kingdom':100}],['1943-02',{France:60,'United Kingdom':40}]],
  CHN: [['1939-09',{Japan:26,Other:74}],['1941-12',{Japan:32,Other:68}],['1942-08',{Japan:38,Other:62}],['1944-06',{Japan:42,Other:58}],['1945-09',{Other:100}]],
  VNM: [['1940-08',{France:100}],['1941-01',{Japan:45,France:55}],['1945-04',{Japan:100}],['1945-09',{France:45,Other:55}]],
  LAO: [['1940-08',{France:100}],['1941-01',{Japan:35,France:65}],['1945-04',{Japan:100}],['1945-09',{France:40,Other:60}]],
  KHM: [['1940-08',{France:100}],['1941-01',{Japan:35,France:65}],['1945-04',{Japan:100}],['1945-09',{France:45,Other:55}]],
  THA: [['1941-11',{Other:100}],['1942-02',{Japan:35,Other:65}],['1945-09',{Other:100}]],
  MMR: [['1941-11',{'United Kingdom':100}],['1942-06',{Japan:100}],['1944-08',{Japan:65,'United Kingdom':35}],['1945-06',{'United Kingdom':100}]],
  MYS: [['1941-11',{'United Kingdom':100}],['1942-03',{Japan:100}],['1945-09',{'United Kingdom':100}]],
  SGP: [['1941-11',{'United Kingdom':100}],['1942-03',{Japan:100}],['1945-09',{'United Kingdom':100}]],
  IDN: [['1941-11',{Other:100}],['1942-05',{Japan:100}],['1945-09',{Other:100}]],
  PHL: [['1941-11',{'United States':100}],['1942-06',{Japan:100}],['1944-10',{Japan:75,'United States':25}],['1945-08',{'United States':100}]],
  PNG: [['1941-11',{'United Kingdom':100}],['1942-09',{Japan:28,'United States':42,'United Kingdom':30}],['1944-01',{Japan:12,'United States':55,'United Kingdom':33}],['1945-08',{'United States':60,'United Kingdom':40}]],
  JPN: [['1945-07',{Japan:100}],['1945-09',{'United States':100}]],
  KOR: [['1945-07',{Japan:100}],['1945-09',{'United States':50,'Soviet Union':50}]],
  PRK: [['1945-07',{Japan:100}],['1945-09',{'Soviet Union':100}]],
  TWN: [['1945-07',{Japan:100}],['1945-09',{Other:100}]]
};

const periods = [];
for (let year = 1939, month = 9; year < 1945 || (year === 1945 && month <= 9);) {
  periods.push(`${year}-${String(month).padStart(2,'0')}`);
  month += 1;
  if (month === 13) { year += 1; month = 1; }
}

const monthIndex = (period) => {
  const [year, month] = period.split('-').map(Number);
  return year * 12 + month;
};
const normalize = (values) => {
  const raw = Object.fromEntries(ENTITIES.map((entity) => [entity, Math.max(0, Number(values[entity] ?? 0))]));
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  return Object.fromEntries(ENTITIES.map((entity) => [entity, raw[entity] / total * 100]));
};
const mixShares = (a, b, t) => normalize(Object.fromEntries(ENTITIES.map((entity) => [
  entity,
  (a[entity] ?? 0) + ((b[entity] ?? 0) - (a[entity] ?? 0)) * t
])));
const baselineFor = (controller) => normalize({[controller]:100});

const sharesFor = (country, period) => {
  const [, , , , baselineController] = country;
  const points = (trajectory[country[0]] ?? []).map(([p, values]) => [p, normalize(values)]);
  if (points.length === 0) return baselineFor(baselineController);
  const baseline = baselineFor(baselineController);
  const all = [[periods[0], baseline], ...points]
    .sort((a,b) => monthIndex(a[0]) - monthIndex(b[0]))
    .filter((item, index, array) => index === 0 || item[0] !== array[index - 1][0]);
  const target = monthIndex(period);
  if (target <= monthIndex(all[0][0])) return all[0][1];
  if (target >= monthIndex(all[all.length - 1][0])) return all[all.length - 1][1];
  for (let i = 0; i < all.length - 1; i += 1) {
    const from = monthIndex(all[i][0]);
    const to = monthIndex(all[i + 1][0]);
    if (target >= from && target <= to) {
      const t = (target - from) / Math.max(1, to - from);
      const eased = t * t * (3 - 2 * t);
      return mixShares(all[i][1], all[i + 1][1], eased);
    }
  }
  return baseline;
};

const lines = ['period,country_code,country_name,numeric_code,entity,value,weight'];
for (const period of periods) {
  for (const country of countries) {
    const [code,name,numeric,weight] = country;
    const shares = sharesFor(country, period);
    for (const entity of ENTITIES) {
      lines.push([period,code,name,numeric,entity,shares[entity].toFixed(4),weight].join(','));
    }
  }
}

const outputDir = path.join(process.cwd(),'public','data');
fs.mkdirSync(outputDir,{recursive:true});
fs.writeFileSync(path.join(outputDir,'sample.csv'),lines.join('\n')+'\n');
console.log(`Generated ${lines.length - 1} WWII control rows for ${countries.length} regions and ${periods.length} months.`);
