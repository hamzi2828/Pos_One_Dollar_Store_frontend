import { cn } from "@/lib/utils";

export const SHOP_NAME = "DOLLAR & Co";

type WordmarkProps = {
  className?: string;
  /** "dark" = on a black background (white "Co", like the shop sign); "light" = on white. */
  tone?: "dark" | "light";
};

/**
 * The shop sign as text: yellow "DOLLAR", green "&", white "Co".
 * On light backgrounds "Co" turns black so it stays readable.
 */
export function Wordmark({ className, tone = "dark" }: WordmarkProps) {
  return (
    <span
      aria-label={SHOP_NAME}
      className={cn("inline-flex items-baseline gap-[0.25em] font-black tracking-tight leading-none", className)}
    >
      <span aria-hidden className={tone === "dark" ? "text-brand-yellow" : "text-yellow-500"}>
        DOLLAR
      </span>
      <span aria-hidden className={tone === "dark" ? "text-brand-green" : "text-green-600"}>
        &amp;
      </span>
      <span aria-hidden className={tone === "dark" ? "text-white" : "text-brand-ink"}>
        Co
      </span>
    </span>
  );
}

export default Wordmark;
