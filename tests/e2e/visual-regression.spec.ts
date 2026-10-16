import { test, expect } from '@playwright/test';
import { loginThroughForm } from './auth-helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('gm_scenario', 'padrao');
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = `
        [aria-label="Controle dos mocks"] { display: none; }
        html { scroll-behavior: auto !important; }
        *, *::before, *::after {
          animation: none !important;
          transition: none !important;
          caret-color: transparent !important;
        }
      `;
      document.head.append(style);
    });
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Início', exact: true })
  ).toBeVisible();
  await page.evaluate(async () => {
    const moduleUrl = '/src/lib/http/client.ts';
    const { http } = await import(moduleUrl);
    await http.post('/api/_mock/reset');
  });
  await page.reload();
  await page.evaluate(() => document.fonts.ready);
});

test('catalog desktop and mobile visual baseline', async ({ page }) => {
  await expect(
    page.getByLabel('NFTs do catálogo').getByRole('link')
  ).toHaveCount(9);
  await expect(page).toHaveScreenshot('catalog.png', {
    animations: 'disabled',
  });
});

test('NFT detail desktop and mobile visual baseline', async ({ page }) => {
  await page.goto('/nfts/golden-signal-160');
  await expect(
    page.getByRole('heading', { name: 'Golden Signal #160', exact: true })
  ).toBeVisible();
  await expect(page).toHaveScreenshot('nft-detail.png', {
    animations: 'disabled',
  });
});

test('cart desktop and mobile visual baseline', async ({ page }) => {
  await page.evaluate(async () => {
    const moduleUrl = '/src/lib/http/client.ts';
    const { http } = await import(moduleUrl);
    await http.post('/api/cart/items', {
      nftId: 'golden-signal-160',
      qty: 1,
    });
  });
  await page.goto('/cart');
  await expect(page.getByRole('heading', { name: /Carrinho/ })).toBeVisible();
  await expect(page).toHaveScreenshot('cart.png', {
    animations: 'disabled',
  });
});

test('checkout desktop and mobile visual baseline', async ({ page }) => {
  await page.goto('/login');
  await loginThroughForm(page);
  await page.goto('/checkout');
  await expect(
    page.getByRole('button', { name: 'Confirmar compra', exact: true })
  ).toBeEnabled();
  await expect(page).toHaveScreenshot('checkout.png', {
    animations: 'disabled',
  });
});
