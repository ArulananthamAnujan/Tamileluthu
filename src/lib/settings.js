import { supabase } from '../supabase.js';
import { SITE } from '../site.js';

const pub = (path) => (path ? supabase.storage.from('branding').getPublicUrl(path).data.publicUrl : '');

export function applySettings(d) {
  if (!d) return;
  Object.assign(SITE, {
    school: d.school_name || SITE.school,
    schoolTa: d.school_name_ta || '',
    tagline: d.tagline || '',
    about: d.about || '',
    contactEmail: d.contact_email || SITE.contactEmail,
    contactPhone: d.contact_phone || '',
    address: d.address || '',
    whatsappUrl: d.whatsapp_url || '',
    logoUrl: pub(d.logo_path),
    heroUrl: pub(d.hero_path),
  });
}

// Loads the school's settings; keeps the built-in defaults if the table is not there yet.
export async function loadSettings() {
  try {
    const { data } = await supabase.from('school_settings').select('*').eq('id', 1).maybeSingle();
    applySettings(data);
    return data;
  } catch { return null; }
}
