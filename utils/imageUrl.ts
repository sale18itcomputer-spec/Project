
export const transformToDirectImageUrl = (url: string | null | undefined): string => {
  if (!url) return '';

  // --- Google Drive Link Transformation ---
  if (url.includes('drive.google.com/uc?export=view')) {
    return url; // Already a direct link
  }
  const driveShareRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
  const driveMatch = url.match(driveShareRegex);
  if (driveMatch && driveMatch[1]) {
    const fileId = driveMatch[1];
    return `https://drive.google.com/uc?export=view&id=${fileId}`;
  }

  // --- Imgur Link Transformation ---
  if (url.includes('i.imgur.com')) {
      return url; // Already a direct link
  }
  const imgurPageRegex = /imgur\.com\/([a-zA-Z0-9]+)$/;
  const imgurMatch = url.match(imgurPageRegex);
  if (imgurMatch && imgurMatch[1]) {
      const imageId = imgurMatch[1];
      // Appending .png is a common convention to get the direct image file.
      return `https://i.imgur.com/${imageId}.png`;
  }

  // If no transformation rule matches, return the original URL
  return url;
};
