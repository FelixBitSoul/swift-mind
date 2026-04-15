import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingConversation() {
  return (
    <div className="flex h-[calc(100svh-1rem)] flex-col">
      <div className="border-b p-4">
        <div className="mb-2 text-sm font-medium">Knowledge bases</div>
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
          <Skeleton className="h-8 w-32 rounded-md" />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          <div className="rounded-lg border p-3">
            <Skeleton className="mb-3 h-3 w-10" />
            <Skeleton className="h-4 w-[78%]" />
            <Skeleton className="mt-2 h-4 w-[56%]" />
          </div>
          <div className="rounded-lg border p-3">
            <Skeleton className="mb-3 h-3 w-10" />
            <Skeleton className="h-4 w-[70%]" />
            <Skeleton className="mt-2 h-4 w-[42%]" />
          </div>
          <div className="rounded-lg border p-3">
            <Skeleton className="mb-3 h-3 w-10" />
            <Skeleton className="h-4 w-[64%]" />
            <Skeleton className="mt-2 h-4 w-[36%]" />
          </div>
        </div>
      </div>

      <div className="border-t p-4">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-2">
          <Skeleton className="h-[96px] w-full rounded-md" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-3 w-48" />
            <Skeleton className="h-9 w-20 rounded-md" />
          </div>
        </div>
      </div>
    </div>
  );
}

