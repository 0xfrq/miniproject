import store from '../../../lib/store';
import api from '../../../lib/api';
import auth from '../../../lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = api.handleApi(async (request, { params }) => {
  const { collection } = await params;
  api.requireCollection(collection);
  const user = store.publicCollections.has(collection) ? null : await auth.requireUser(request);
  return Response.json(await store.list(collection, user));
});

export const POST = api.handleApi(async (request, { params }) => {
  const { collection } = await params;
  api.requireCollection(collection);
  const user = await auth.requireUser(request, store.publicCollections.has(collection) ? ['admin'] : ['admin', 'guru']);
  const body = await api.readObject(request, 'Payload tidak valid.');
  if (collection === 'assessments' && body.questions !== undefined) {
    const { questions, ...assessment } = body;
    return Response.json(await store.createAssessment(assessment, questions, user), { status: 201 });
  }
  return Response.json(await store.create(collection, body, user), { status: 201 });
});
