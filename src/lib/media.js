// Homework files and YouTube links (no browser or server needed, so tests can use it).

// The 11-character video id from any usual YouTube link, or null.
export function youtubeId(u) {
  try {
    const x = new URL(String(u || '').trim());
    if (x.protocol !== 'https:' && x.protocol !== 'http:') return null;
    const h = x.hostname.toLowerCase().replace(/^(www|m|music)\./, '');
    let id = null;
    if (h === 'youtu.be') id = x.pathname.split('/')[1];
    else if (h === 'youtube.com' || h === 'youtube-nocookie.com') {
      if (x.pathname === '/watch') id = x.searchParams.get('v');
      else id = (x.pathname.match(/^\/(?:shorts|embed|live)\/([^/?#]+)/) || [])[1];
    }
    return /^[\w-]{11}$/.test(id || '') ? id : null;
  } catch { return null; }
}
export const youtubeWatchUrl = (id) => `https://www.youtube.com/watch?v=${id}`;
export const youtubeEmbedUrl = (id) => `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
export const youtubeThumb = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;

// File types a teacher can attach to a diary post (the storage bucket allows the same list).
export const FILE_TYPES = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
};
export const FILE_ACCEPT = Object.keys(FILE_TYPES).map((e) => '.' + e).join(',');
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_FILES = 8;

export const fileExt = (name) => { const m = /\.([a-z0-9]+)$/i.exec(name || ''); return m ? m[1].toLowerCase() : ''; };
export function fmtSize(bytes) {
  if (!bytes) return '';
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
