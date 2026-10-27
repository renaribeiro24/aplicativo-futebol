import Link from "next/link";
import { brand } from "@/lib/brand";
export function Brand() {
  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-semibold tracking-tight"
      aria-label={`${brand.name}, início`}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-brand text-brand-foreground">
        <svg
          className="size-6"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <circle
            cx="16"
            cy="16"
            r="12"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="m16 10 6 4-2 7h-8l-2-7 6-4ZM16 4v6m11 2-5 2m1 12-3-5M9 26l3-5M5 12l5 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className="font-display text-xl font-black tracking-tight">
        {brand.name}
      </span>
    </Link>
  );
}
