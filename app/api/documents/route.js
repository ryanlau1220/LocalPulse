import { analyzeDocuments } from '../../../lib/documents';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request) {
  try {
    const size = Number(request.headers.get('content-length') || 0);
    if (size > 16 * 1024 * 1024) return Response.json({ error: 'The upload is too large.' }, { status: 413 });
    const form = await request.formData();
    const files = form.getAll('files').filter(value => typeof value !== 'string');
    const notes = form.get('notes') || '';
    return Response.json(await analyzeDocuments(files, notes));
  } catch (error) {
    return Response.json({ error: error.message || 'Unable to analyze the information.' }, { status: 400 });
  }
}
