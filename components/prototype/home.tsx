"use client";

/**
 * PROTOTYPE (#shell). Throwaway: the home in the shape the device is set to.
 * The figures come from the server once; only the layout changes.
 */
import { HomeA } from "@/components/prototype/home-a";
import { HomeB } from "@/components/prototype/home-b";
import { HomeC } from "@/components/prototype/home-c";
import { useShellVariant } from "@/components/prototype/switcher";
import type { HomeData } from "@/lib/prototype-home";

export function PrototypeHome({ data }: { data: HomeData }) {
  const variant = useShellVariant();

  if (variant === "B") {
    return <HomeB data={data} />;
  }
  if (variant === "C") {
    return <HomeC data={data} />;
  }
  return <HomeA data={data} />;
}
