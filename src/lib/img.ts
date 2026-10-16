import { getImageProps } from "next/image";

const STORAGE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;

/**
 * Props for a plain <img> of a site photo (trainer, gallery, streak wall…): a resized WebP/AVIF srcset through Next's
 * image optimizer for our Supabase storage and Unsplash — the originals are up to 5 MB, 2000 px wide — and the URL as-is
 * for anything else (a photo link pasted from another site the optimizer isn't allowed to fetch).
 * Width/height are left to the element's CSS, so existing layouts don't change.
 */
export function siteImg(src: string, sizes: string) {
  if (!src.startsWith(STORAGE) && !src.startsWith("https://images.unsplash.com/photo-")) return { src };
  const { props } = getImageProps({ src, alt: "", sizes, width: 1600, height: 1600, quality: 75 });
  return { src: props.src, srcSet: props.srcSet, sizes: props.sizes };
}
