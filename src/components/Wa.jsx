import React from 'react';
import Icon from './Icon.jsx';
import { waLink } from '../lib/wa.js';
import { t } from '../i18n.js';

// Opens WhatsApp with a ready-written message (to one number, or "choose a chat").
export default function WaButton({ text, phone, label, small = true, title }) {
  return (
    <a className={'btn wa' + (small ? ' small' : '')} href={waLink(text, phone)} target="_blank" rel="noopener noreferrer"
      title={title || (phone ? t('Message on WhatsApp') : t('Share on WhatsApp'))}>
      <Icon name="whatsapp" size={small ? 15 : 18} />{label ?? (phone ? 'WhatsApp' : t('Share'))}
    </a>
  );
}
