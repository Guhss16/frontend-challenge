import { test, expect } from 'vitest';
import * as s from '@/lib/http/schemas';
import { call, error, login } from './helpers';
test('favorites idempotency and user isolation', async () => {
  const gustavo = await login();
  const gabriel = await login('gabriel');
  const path = '/favorites/golden-frequency-071';
  const first = await call('put', path, s.favoritesResponseSchema, {}, gustavo);
  expect(await call('put', path, s.favoritesResponseSchema, {}, gustavo)).toEqual(
    first
  );
  expect(
    (
      await call(
        'get',
        '/favorites',
        s.favoritesResponseSchema,
        undefined,
        gabriel
      )
    ).ids
  ).toEqual([]);
  const removed = await call(
    'delete',
    path,
    s.favoritesResponseSchema,
    undefined,
    gustavo
  );
  expect(
    await call('delete', path, s.favoritesResponseSchema, undefined, gustavo)
  ).toEqual(removed);
  await error('put', '/favorites/missing', 'NOT_FOUND', 404, {}, gustavo);
  await error('get', '/favorites', 'UNAUTHORIZED', 401);
});
