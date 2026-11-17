import { XMLParser } from 'fast-xml-parser';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const parser = new XMLParser({ignoreAttributes:false,attributeNamePrefix:'',isArray:name=>['node','way','relation','tag'].includes(name)});
export async function GET(request) {
  const search = new URL(request.url).searchParams.get('q')?.trim().toLowerCase().slice(0, 100) || '';
  // A fixed area around Jalan Telawi; user text is only used for local filtering.
  try {
    const response = await fetch('https://api.openstreetmap.org/api/0.6/map?bbox=101.667,3.123,101.681,3.136', {headers:{'User-Agent':'LocalPulse prototype'},signal:AbortSignal.timeout(25000),cache:'no-store'});
    if (!response.ok) throw new Error(`Map data service returned ${response.status}.`);
    const osm = parser.parse(await response.text()).osm;
    const results=[];
    for(const type of ['node','way','relation']) for(const item of osm[type]||[]) {
      const tags=Object.fromEntries((item.tag||[]).map(tag=>[tag.k,String(tag.v)]));
      if (!tags.name || !/^(cafe|restaurant|fast_food|food_court)$/.test(tags.amenity||'') || (search && !tags.name.toLowerCase().includes(search))) continue;
      results.push({id:`osm-${type}-${item.id}`,name:tags.name,category:tags.amenity.replaceAll('_',' '),location:[tags['addr:street'],tags['addr:city']].filter(Boolean).join(', ')||'Bangsar, Kuala Lumpur',url:tags.website||tags['contact:website']||'',phone:tags.phone||tags['contact:phone']||'',source:'OpenStreetMap',sourceUrl:`https://www.openstreetmap.org/${type}/${item.id}`});
    }
    results.sort((a,b)=>a.name.localeCompare(b.name));
    return Response.json({results,source:'OpenStreetMap'});
  } catch(error) { return Response.json({error:`Business search is unavailable. ${error.message}`,results:[]},{status:503}); }
}
