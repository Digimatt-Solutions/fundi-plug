import { ImgHTMLAttributes } from "react";
import { useSignedUrl } from "@/lib/storageUrl";
import { AvatarImage } from "@/components/ui/avatar";

interface AssetImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> {
  src?: string | null;
  bucket?: string;
  ttl?: number;
}

/** Drop-in replacement for `<img>` that always renders a fresh signed URL for private buckets. */
export function AssetImage({ src, bucket, ttl, ...rest }: AssetImageProps) {
  const resolved = useSignedUrl(src ?? null, bucket, ttl);
  if (!resolved) return null;
  return <img src={resolved} {...rest} />;
}

interface AssetAvatarImageProps {
  src?: string | null;
  alt?: string;
  className?: string;
  bucket?: string;
}

/** Drop-in for shadcn's `<AvatarImage>` that resolves signed URLs first. */
export function AssetAvatarImage({ src, alt, className, bucket }: AssetAvatarImageProps) {
  const resolved = useSignedUrl(src ?? null, bucket);
  if (!resolved) return null;
  return <AvatarImage src={resolved} alt={alt} className={className} />;
}
