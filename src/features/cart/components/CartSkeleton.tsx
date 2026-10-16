import { Skeleton } from '@/components/ui/skeleton';

export function CartSkeleton({ summary = false }: { summary?: boolean }) {
  return (
    <div
      role="status"
      aria-label={summary ? 'Carregando resumo' : 'Carregando carrinho'}
      aria-busy="true"
      className="grid min-w-0"
    >
      <span className="sr-only">
        {summary ? 'Carregando resumo…' : 'Carregando itens do carrinho…'}
      </span>
      {summary ? (
        <div aria-hidden="true" className="grid">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-6 w-1/2" />
        </div>
      ) : (
        <div aria-hidden="true" className="grid">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="grid grid-cols-[auto_minmax(0,1fr)]">
              <Skeleton className="aspect-square w-24" />
              <div className="grid min-w-0">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
