import { XMLParser } from 'fast-xml-parser';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',isArray:name=>['node','way','relation','tag'].includes(name)});
export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const search = params.get('q')?.trim().toLowerCase().slice(0,100) || '';
  const lat = params.has('lat') ? Number(params.get('lat')) : 3.139;
  const lon = params.has('lon') ? Number(params.get('lon')) : 101.6869;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat)>89 || Math.abs(lon)>179) return Response.json({error:'Invalid search location.',results:[]},{status:400});
  const label = (params.get('location') || 'Kuala Lumpur, Malaysia').slice(0,100);
  const bbox = [lon-.006,lat-.006,lon+.006,lat+.006].map(n=>n.toFixed(5)).join(',');
  try {
    const response = await fetch(`https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`, {headers:{'User-Agent':'LocalPulse/1.0 (local business discovery)'},signal:AbortSignal.timeout(25000),cache:'no-store'});
    if (!response.ok) throw new Error(`Map data service returned ${response.status}.`);
    const osm = parser.parse(await response.text()).osm;
    const results=[];
    for(const type of ['node','way','relation']) for(const item of osm[type]||[]) {
      const tags=Object.fromEntries((item.tag||[]).map(tag=>[tag.k,String(tag.v)]));
      const category=tags.amenity||tags.shop||tags.tourism||'';
      if (!tags.name || !/^(cafe|restaurant|fast_food|food_court|bakery|hairdresser|beauty|florist|clothes|car_repair|convenience|clinic|dentist|hotel|guest_house)$/.test(category) || (search && !tags.name.toLowerCase().includes(search))) continue;
      results.push({id:`osm-${type}-${item.id}`,name:tags.name,category:category.replaceAll('_',' '),location:[tags['addr:street'],tags['addr:city']].filter(Boolean).join(', ')||label,url:tags.website||tags['contact:website']||'',phone:tags.phone||tags['contact:phone']||'',source:'OpenStreetMap',sourceUrl:`https://www.openstreetmap.org/${type}/${item.id}`});
    }
    results.sort((a,b)=>a.name.localeCompare(b.name));
    return Response.json({results,source:'OpenStreetMap',location:label});
  } catch(error) { return Response.json({error:`Business search is unavailable. ${error.message}`,results:[]},{status:503}); }
}
