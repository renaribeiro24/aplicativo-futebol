import Link from "next/link";
import { CircleDot } from "lucide-react";
export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-semibold tracking-tight"
      aria-label="Em Campo, início"
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <CircleDot className="size-5" aria-hidden="true" />
      </span>
      <span className="text-xl">
        em campo<span className="text-primary">.</span>
      </span>
    </Link>
  );
}
