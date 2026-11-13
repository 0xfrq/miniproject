import auth from '../../../../../lib/auth';
import api from '../../../../../lib/api';
import store from '../../../../../lib/store';
import csv from '../../../../../lib/grade-csv';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (request, { params }) => {
  const user = await auth.requireUser(request);
  const { id } = await params;
  const data = await store.assessmentGrades(id, user);
  if (!data) throw new api.ApiError(404, 'Ulangan tidak ditemukan.');
  const file = csv.gradeCsv(data.assessment, data.results);
  return new Response(file.content, { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${file.filename}"`,
    'X-Content-Type-Options': 'nosniff', 'X-Export-Row-Count': String(file.count),
  } });
});
