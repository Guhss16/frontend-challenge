const responsiveImages = new Set([
  '/assets/nft/golden-frequency-071.webp',
  '/assets/nft/golden-signal-160.webp',
  '/assets/nft/sage-nomad-009.webp',
  '/assets/nft/violet-nomad-314.webp',
]);

export function nftImageSrcSet(src: string): string | undefined {
  if (!responsiveImages.has(src)) return undefined;
  const base = src.slice(0, -'.webp'.length);
  return `${base}-400.webp 400w, ${base}-640.webp 640w, ${src} 1254w`;
}
