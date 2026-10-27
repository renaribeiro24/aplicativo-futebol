import Link from "next/link";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";

export function Brand({
  variant = "horizontal",
  tone = "auto",
  linked = true,
  className,
}: {
  variant?: "horizontal" | "main";
  tone?: "auto" | "dark" | "light" | "white" | "graphite";
  linked?: boolean;
  className?: string;
}) {
  const file = (color: Exclude<typeof tone, "auto">) =>
    `${brand.assets.root}/borafute-horizontal-${color}.svg`;
  const artwork = (
    <>
      <picture>
        {tone === "auto" && (
          <source media="(prefers-color-scheme: dark)" srcSet={file("dark")} />
        )}
        {/* Vector image: native picture preserves exact color variants without JS. */}
        <img
          src={file(tone === "auto" ? "light" : tone)}
          width={brand.assets.width}
          height={166}
          className="block h-auto w-full"
          alt={linked ? "" : brand.name}
        />
      </picture>
      {variant === "main" && (
        <p
          aria-hidden={linked ? true : undefined}
          className={cn(
            "mt-2 text-center text-xs font-bold tracking-[.16em] uppercase italic",
            tone === "dark"
              ? "text-brand"
              : tone === "white"
                ? "text-pitch-foreground"
                : tone === "graphite"
                  ? "text-brand-foreground"
                  : "text-primary",
          )}
        >
          {brand.slogan}
        </p>
      )}
    </>
  );
  const classes = cn("block w-40 max-w-full shrink-0", className);
  return linked ? (
    <Link href="/" className={classes} aria-label={`${brand.name}, início`}>
      {artwork}
    </Link>
  ) : (
    <div className={classes}>{artwork}</div>
  );
}
