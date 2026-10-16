/** Return a Cloudinary public ID, or a full remote URL for deliveryType="fetch". */
export function extractCloudinaryId(input: string): string {
  const value = input.trim();
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value.replace(/^\/+/, '');
  }
  if (!['https:', 'http:'].includes(url.protocol)) return '';
  if (url.hostname.toLowerCase() !== 'res.cloudinary.com') return url.toString();

  const sections = url.pathname.split('/').filter(Boolean);
  if (sections.length < 4) return url.toString();
  const [cloud, assetType, deliveryType, ...path] = sections;
  if (assetType !== 'image') return url.toString();
  const configured = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  if (!configured || cloud !== configured) return url.toString();
  if (deliveryType === 'fetch') {
    try { return decodeURIComponent(path.join('/')); } catch { return url.toString(); }
  }
  if (deliveryType !== 'upload' || !path.length) return url.toString();

  const versionIndex = path.findIndex((part) => /^v\d+$/.test(part));
  const identifier = versionIndex >= 0 ? path.slice(versionIndex + 1) : path;
  if (!identifier.length) return url.toString();
  let raw: string;
  try { raw = decodeURIComponent(identifier.join('/')); } catch { return url.toString(); }
  return raw.replace(/\.(?:jpe?g|png|gif|webp|avif|tiff?|bmp)$/i, '');
}
