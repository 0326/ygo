import type { Lang } from "../../shared/types";

export function imgThumb(key: string | number, lang?: Lang): string {
  const base = `/img/${key}/s`;
  if (lang && lang !== "en") return `${base}?lang=${lang}`;
  return base;
}

export function imgFull(key: string | number, lang?: Lang): string {
  const base = `/img/${key}`;
  if (lang && lang !== "en") return `${base}?lang=${lang}`;
  return base;
}

export function imgArt(key: string | number): string {
  return `/img/${key}/art`;
}
