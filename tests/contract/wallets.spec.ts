import { test, expect } from 'vitest';
import * as s from '@/lib/http/schemas';
import { call, error, login } from './helpers';
const data = {
  label: 'Principal',
  address: `0x${'a'.repeat(40)}`,
  network: 'ethereum',
  isPrimary: true,
};
test('wallet create duplicate limit promote ownership and pending network', async () => {
  const gustavo = await login();
  const gabriel = await login('gabriel');
  expect(
    (await call('get', '/wallets', s.walletsListResponseSchema, undefined, gustavo))
      .items
  ).toHaveLength(2);
  const first = await call(
    'post',
    '/wallets',
    s.walletSchema,
    data,
    gabriel,
    201
  );
  await error(
    'post',
    '/wallets',
    'CONFLICT',
    409,
    { ...data, address: data.address.toUpperCase().replace('0X', '0x') },
    gabriel
  );
  const second = await call(
    'post',
    '/wallets',
    s.walletSchema,
    { ...data, address: `0x${'b'.repeat(40)}` },
    gabriel,
    201
  );
  expect(second.isPrimary).toBe(true);
  await call(
    'patch',
    `/wallets/${first.id}`,
    s.walletSchema,
    { isPrimary: true },
    gabriel
  );
  expect(
    (
      await call(
        'get',
        '/wallets',
        s.walletsListResponseSchema,
        undefined,
        gabriel
      )
    ).items.filter((w) => w.isPrimary)
  ).toHaveLength(1);
  await error(
    'post',
    '/wallets',
    'CONFLICT',
    409,
    { ...data, address: `0x${'c'.repeat(40)}` },
    gabriel
  );
  await error(
    'patch',
    '/wallets/wal_gustavo_principal',
    'FORBIDDEN',
    403,
    { label: 'Other' },
    gabriel
  );
  await error(
    'patch',
    '/wallets/wal_gustavo_principal',
    'CONFLICT',
    409,
    { network: 'sepolia' },
    gustavo
  );
  await error('patch', '/wallets/absent', 'NOT_FOUND', 404, {}, gustavo);
  await error(
    'post',
    '/wallets',
    'VALIDATION_ERROR',
    422,
    { ...data, address: 'bad' },
    gabriel
  );
});

test('checkout wallet edits persist, validate ENS and reject duplicate addresses', async () => {
  const headers = await login();
  const id = 'wal_gustavo_ens';
  const data = {
    address: `0x${'c'.repeat(40)}`,
    network: 'ethereum',
    provider: 'coinbase',
    ensName: 'gustavo-nova.eth',
    secondaryIdentity: 'colecao.eth',
    note: 'Compra da coleção',
  };
  const wallet = await call(
    'patch',
    `/wallets/${id}`,
    s.walletSchema,
    data,
    headers
  );
  expect(wallet).toMatchObject(data);
  const wallets = await call(
    'get',
    '/wallets',
    s.walletsListResponseSchema,
    undefined,
    headers
  );
  expect(wallets.items.find((item) => item.id === id)).toEqual(wallet);
  await error(
    'patch',
    `/wallets/${id}`,
    'CONFLICT',
    409,
    { address: wallets.items.find((item) => item.id !== id)!.address },
    headers
  );
  await error(
    'patch',
    `/wallets/${id}`,
    'VALIDATION_ERROR',
    422,
    { ensName: 'invalid' },
    headers
  );
  await error(
    'patch',
    '/wallets/wal_gustavo_principal',
    'CONFLICT',
    409,
    { address: `0x${'d'.repeat(40)}` },
    headers
  );
});
