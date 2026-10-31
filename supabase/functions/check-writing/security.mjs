export const MAX_TEXT = 20000;
export const MAX_PAGES = 10;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validPhotoPath(path, owner) {
  if (typeof path !== 'string' || !UUID.test(owner)) return false;
  const parts = path.split('/');
  return parts.length === 3 && parts[0] === owner && UUID.test(parts[1]) && /^page-\d{2}\.jpg$/.test(parts[2]);
}

export function validateSubmission(sub, owner) {
  if (!sub || sub.student_id !== owner) throw new Error('Invalid submission owner.');
  if (typeof sub.original_text === 'string' && sub.original_text.length > MAX_TEXT) throw new Error('Writing exceeds 20,000 characters.');
  if (!Array.isArray(sub.photo_paths) || sub.photo_paths.length > MAX_PAGES) throw new Error('Up to 10 photos are allowed.');
  if (new Set(sub.photo_paths).size !== sub.photo_paths.length || sub.photo_paths.some(p => !validPhotoPath(p, owner))) throw new Error('Invalid photo ownership or path.');
  if (sub.input_mode === 'photo') {
    if (!sub.photo_paths.length) throw new Error('Add at least one photo.');
  } else if (sub.input_mode === 'text') {
    if (sub.photo_paths.length || typeof sub.original_text !== 'string' || !sub.original_text.trim()) throw new Error('Invalid text submission.');
  } else throw new Error('Invalid input mode.');
}

export function validatePhoto(file, total) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_FILE_BYTES || file.size === 0) throw new Error('Invalid photo type or size.');
  if (total + file.size > MAX_TOTAL_BYTES) throw new Error('Photos exceed the 20 MB total limit.');
  return total + file.size;
}
