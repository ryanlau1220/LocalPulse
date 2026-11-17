import { inspect } from '../../../lib/inspect';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const body = await request.text();
    if (body.length > 5000) throw new Error('Request too large.');
    const { url } = JSON.parse(body);
    if (typeof url !== 'string' || !url) throw new Error('Enter a website URL.');
    return Response.json(await inspect(url));
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to check website.' }, { status: 400 });
  }
}
