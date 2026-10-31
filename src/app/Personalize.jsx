import React from 'react';
import { THEMES, HOME_CARDS, usePrefs, setPrefs } from './prefs.js';
import { t, tl, useLang, setLang } from '../i18n.js';
import { buzz } from './isApp.js';
import { supabase } from '../supabase.js';
import Icon from '../components/Icon.jsx';

export default function Personalize({ profile }) {
  const p = usePrefs();
  const lang = useLang();
  const toggle = (k) => setPrefs({ hidden: p.hidden.includes(k) ? p.hidden.filter((x) => x !== k) : [...p.hidden, k] });
  const pickLang = (l) => { buzz(); setLang(l); supabase.from('profiles').update({ lang: l }).eq('id', profile.id).then(() => {}); };
  return (
    <div className="ax-stack">
      <section className="ax-card">
        <span className="ax-kicker">{t('Colour theme')} · வண்ணம்</span>
        <div className="themes">
          {Object.entries(THEMES).map(([k, v]) => (
            <button key={k} className={'theme' + (p.theme === k ? ' on' : '')} onClick={() => { buzz(); setPrefs({ theme: k }); }} aria-pressed={p.theme === k}>
              <span className="sw" style={{ background: `linear-gradient(135deg, ${v.swatch[0]} 55%, ${v.swatch[1]} 55%)` }}>{p.theme === k && <Icon name="check" size={18} stroke={3} />}</span>
              <span>{tl(v)}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="ax-card">
        <span className="ax-kicker">{t('Text size')} · எழுத்தளவு</span>
        <div className="seg-x">
          {[['sm', 'அ', t('Small')], ['md', 'அ', t('Normal')], ['lg', 'அ', t('Large')]].map(([k, a, l], i) => (
            <button key={k} className={p.text === k ? 'on' : ''} onClick={() => { buzz(); setPrefs({ text: k }); }}>
              <b style={{ fontSize: 15 + i * 5 }}>{a}</b><small>{l}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="ax-card">
        <span className="ax-kicker">{t('Language')} · மொழி</span>
        <div className="seg-x">
          <button className={lang === 'en' ? 'on' : ''} onClick={() => pickLang('en')}><b>English</b></button>
          <button className={lang === 'ta' ? 'on' : ''} onClick={() => pickLang('ta')}><b>தமிழ்</b></button>
        </div>
      </section>
      <section className="ax-card form">
        <span className="ax-kicker">{t('What should we call you?')}</span>
        <input value={p.nickname} maxLength={30} onChange={(e) => setPrefs({ nickname: e.target.value })}
          placeholder={profile.full_name?.split(' ')[0] || ''} aria-label={t('Nickname')} />
        <p className="small muted">{t('Shown in your greeting on this phone only.')}</p>
      </section>
      <section className="ax-card">
        <span className="ax-kicker">{t('Home screen cards')}</span>
        {Object.entries(HOME_CARDS).map(([k, v]) => (
          <label key={k} className="switch-row">
            <span>{tl(v)}</span>
            <input type="checkbox" role="switch" checked={!p.hidden.includes(k)} onChange={() => { buzz(); toggle(k); }} />
          </label>
        ))}
      </section>
    </div>
  );
}
