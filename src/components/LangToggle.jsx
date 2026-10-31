import React from 'react';
import { useLang, setLang, t } from '../i18n.js';
import { supabase } from '../supabase.js';
import Icon from './Icon.jsx';

// Switches the whole site between English and Tamil (and remembers it on the account).
export default function LangToggle({ profileId, className = '' }) {
  const lang = useLang();
  const next = lang === 'ta' ? 'en' : 'ta';
  return (
    <button className={'btn small langbtn ' + className} onClick={() => {
      setLang(next);
      if (profileId) supabase.from('profiles').update({ lang: next }).eq('id', profileId).then(() => {});
    }} title={t('Change language')} aria-label={t('Change language')}>
      <Icon name="globe" size={15} />{lang === 'ta' ? 'English' : 'தமிழ்'}
    </button>
  );
}
