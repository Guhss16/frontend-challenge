import type { StoredWallet } from '../db/store'

export const WALLET_GUSTAVO_PRINCIPAL: StoredWallet = {
  id: 'wal_gustavo_principal',
  userId: 'usr_gustavo',
  label: 'Carteira principal',
  address: '0x1a2b3c4d5e6f708192a3b4c5d6e7f80912345678',
  network: 'ethereum',
  isPrimary: true,
  createdAt: '2026-01-16T09:00:00.000Z',
}

export const WALLET_GUSTAVO_ENS: StoredWallet = {
  id: 'wal_gustavo_ens',
  userId: 'usr_gustavo',
  label: 'Carteira secundária',
  address: '0x9f8e7d6c5b4a39281706f5e4d3c2b1a098765432',
  network: 'sepolia',
  isPrimary: false,
  ensName: 'guhss16.eth',
  createdAt: '2026-02-20T09:00:00.000Z',
}

export const SEED_WALLETS: StoredWallet[] = [WALLET_GUSTAVO_PRINCIPAL, WALLET_GUSTAVO_ENS]
