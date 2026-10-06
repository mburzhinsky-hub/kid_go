export function HomeSkeleton() {
  return (
    <main className="px-4 pt-5" aria-busy>
      <div className="flex justify-between">
        <div className="h-9 w-32 rounded-xl skeleton" />
        <div className="h-10 w-28 rounded-full skeleton" />
      </div>
      <div className="mt-4 h-12 rounded-full skeleton" />
      <div className="mt-4 flex gap-2.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[62px] w-[62px] shrink-0 rounded-[20px] skeleton" />
        ))}
      </div>
      <div className="mt-5 aspect-[16/10.4] rounded-[28px] skeleton" />
      <div className="mt-6 grid grid-cols-2 gap-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-[76px] rounded-[20px] skeleton" />
        ))}
      </div>
    </main>
  );
}

export function DetailSkeleton() {
  return (
    <main aria-busy>
      <div className="h-[330px] rounded-b-[30px] skeleton" />
      <div className="px-4">
        <div className="mt-6 h-9 w-3/4 rounded-xl skeleton" />
        <div className="mt-3 h-5 w-1/2 rounded-lg skeleton" />
        <div className="mt-5 flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-9 w-24 rounded-full skeleton" />
          ))}
        </div>
        <div className="mt-6 grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 rounded-2xl skeleton" />
          ))}
        </div>
        <div className="mt-6 space-y-2">
          <div className="h-4 rounded skeleton" />
          <div className="h-4 rounded skeleton" />
          <div className="h-4 w-2/3 rounded skeleton" />
        </div>
      </div>
    </main>
  );
}
