import { test, expect } from 'vitest';
import * as s from '@/lib/http/schemas';
import { http } from '@/lib/http/client';
import { call, error, login, scenario } from './helpers';

test('default checkout referral persists and rejects invalid codes', async () => {
  const headers = await login();
  const profile = await call(
    'patch',
    '/profile',
    s.profileSchema,
    { referralCode: '  NFT Marketplace  ' },
    headers
  );
  expect(profile.referralCode).toBe('NFT Marketplace');
  expect(
    (await call('get', '/profile', s.profileSchema, undefined, headers))
      .referralCode
  ).toBe('NFT Marketplace');
  for (const referralCode of ['INVALID!', 'A'.repeat(41)]) {
    const result = await error(
      'patch',
      '/profile',
      'VALIDATION_ERROR',
      422,
      { referralCode },
      headers
    );
    expect(result.error.fields?.referralCode).toBeDefined();
  }
});
test('profile editing uniqueness and password change', async () => {
  const headers = await login();
  await call('get', '/profile', s.profileSchema, undefined, headers);
  expect(
    (
      await call(
        'patch',
        '/profile',
        s.profileSchema,
        { name: 'Gustavo C.', bio: 'Arte' },
        headers
      )
    ).name
  ).toBe('Gustavo C.');
  await error(
    'patch',
    '/profile',
    'CONFLICT',
    409,
    { username: 'gabriel' },
    headers
  );
  await error(
    'patch',
    '/profile',
    'VALIDATION_ERROR',
    422,
    { avatarUrl: 'data:text/plain;base64,YQ==' },
    headers
  );
  await error(
    'post',
    '/profile/password',
    'VALIDATION_ERROR',
    422,
    { currentPassword: 'wrong', newPassword: 'NovaSenha123' },
    headers
  );
  expect(
    (
      await http.post(
        'http://localhost/api/profile/password',
        { currentPassword: 'Gustavo11011', newPassword: 'NovaSenha123' },
        { headers }
      )
    ).status
  ).toBe(204);
  await call('get', '/auth/session', s.sessionSchema, undefined, headers);
  await call('post', '/auth/login', s.sessionSchema, {
    email: 'gustavo@email.com',
    password: 'NovaSenha123',
  });
  await scenario('validacao-api');
  await error(
    'patch',
    '/profile',
    'VALIDATION_ERROR',
    422,
    { name: 'Gustavo' },
    headers
  );
});

test('checkout profile fields persist and email becomes the login identity', async () => {
  const headers = await login();
  const value = await call(
    'patch',
    '/profile',
    s.profileSchema,
    {
      name: 'Gustavo Editado',
      email: 'GUSTAVO.NOVA@nft-marketplace.test',
      username: 'gustavo.nova',
      profileName: 'Coleção do Gustavo',
      referralCode: 'KURIO_2026',
    },
    headers
  );
  expect(value).toMatchObject({
    email: 'gustavo.nova@nft-marketplace.test',
    profileName: 'Coleção do Gustavo',
    referralCode: 'KURIO_2026',
  });
  expect(
    await call('get', '/profile', s.profileSchema, undefined, headers)
  ).toEqual(value);
  const session = await call('post', '/auth/login', s.sessionSchema, {
    email: value.email,
    password: 'Gustavo11011',
  });
  expect(session.user.email).toBe(value.email);
  await error(
    'patch',
    '/profile',
    'CONFLICT',
    409,
    { email: 'gabriel@email.com' },
    headers
  );
  expect(
    (await call('get', '/profile', s.profileSchema, undefined, headers)).email
  ).toBe(value.email);
});

test('avatar accepts a data URL and null removes it without leaking null into reads', async () => {
  const headers = await login();
  const avatarUrl = 'data:image/png;base64,iVBORw0KGgo=';
  expect(
    (await call('patch', '/profile', s.profileSchema, { avatarUrl }, headers))
      .avatarUrl
  ).toBe(avatarUrl);
  expect(
    (
      await call(
        'patch',
        '/profile',
        s.profileSchema,
        { avatarUrl: null },
        headers
      )
    ).avatarUrl
  ).toBeUndefined();
  expect(
    (await call('get', '/profile', s.profileSchema, undefined, headers))
      .avatarUrl
  ).toBeUndefined();
});
