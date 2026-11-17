export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  const key=process.env.GOOGLE_PLACES_API_KEY;
  if(!key) return Response.json({error:'Google checking is not connected. Add a Google Places API key after setting a spending cap.'},{status:503});
  try {
    const data=await request.json();
    if(typeof data.name!=='string'||!data.name.trim()||data.name.length>150) return Response.json({error:'Provide a business name.'},{status:400});
    const response=await fetch('https://places.googleapis.com/v1/places:searchText',{method:'POST',headers:{'Content-Type':'application/json','X-Goog-Api-Key':key,'X-Goog-FieldMask':'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.googleMapsUri'},body:JSON.stringify({textQuery:`${data.name} Bangsar Kuala Lumpur`,maxResultCount:5}),cache:'no-store',signal:AbortSignal.timeout(12000)});
    if(!response.ok) return Response.json({error:'Google could not complete this check. Check your key, enabled API, and quota.'},{status:502});
    const result=await response.json();
    // Show candidates for user selection: names alone do not establish identity.
    return Response.json({places:result.places||[]});
  } catch {return Response.json({error:'Google checking is temporarily unavailable.'},{status:502});}
}
