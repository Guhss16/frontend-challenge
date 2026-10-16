import { Link } from '@tanstack/react-router';
import type { Nft } from '@/types/api';
import { Price } from './Price';
import { displayEth } from '@/lib/money';
import { nftImageSrcSet } from '@/lib/nft-image';

export function NFTCard({ nft }: { nft: Nft }) {
  return (
    <Link
      key={nft.id}
      to="/nfts/$nftId"
      params={{ nftId: nft.id }}
      search={{ qty: 1 }}
      aria-label={`${nft.name} ${displayEth(nft.price)}${
        nft.previousPrice ? ` ${displayEth(nft.previousPrice)}` : ''
      }`}
    >
      <div className="bg-surface-card rounded-xl px-1 pt-5 pb-3 md:rounded-none md:px-0 md:pt-7.75 md:pb-4.75">
        <img
          src={nft.image}
          srcSet={nftImageSrcSet(nft.image)}
          sizes="(min-width: 1024px) 30vw, (min-width: 360px) 50vw, 100vw"
          alt={`${nft.name}, coleção ${nft.collection}`}
          width={360}
          height={360}
          loading="lazy"
          className="aspect-square w-full rounded-[15px] object-cover"
        />
      </div>
      <div className="mt-2 md:mt-3">
        <h3 className="text-body">{nft.name}</h3>
        <p className="text-body-lg-bold">
          <Price value={nft.price} previousPrice={nft.previousPrice} />
        </p>
      </div>
    </Link>
  );
}
