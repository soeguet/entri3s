import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Tailwind-bewusstes className-Merging (shadcn-Konvention). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
