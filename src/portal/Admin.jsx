import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { t } from '../i18n.js';
import { isoDay, addDays, fmtDay } from '../lib/util.js';
import { downloadCsv } from '../lib/csv.js';
import { loadSettings } from '../lib/settings.js';
import { SITE } from '../site.js';

// Principal / school admin: whole-school overview, teachers, and school details.
export default function Admin({ ctx, onSettings }) {
  const [tab, setTab] = useState('overview');
  if (!ctx.profile.is_admin) return <div className="card"><p>{t('Only the school admin can open this page.')}</p></div>;
  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">{t('School admin')} <span className="ta">· நிர்வாகம்</span></h2>
        <div className="tabs">
          <button className={tab === 'overview' ? 'on' : ''} onClick={() => setTab('overview')}>{t('Overview')}</button>
          <button className={tab === 'staff' ? 'on' : ''} onClick={() => setTab('staff')}>{t('Teachers')}</button>
          <button className={tab === 'school' ? 'on' : ''} onClick={() => setTab('school')}>{t('School details')}</button>
        </div>
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'staff' && <Staff me={ctx.profile} />}
      {tab === 'school' && <School onSaved={onSettings} />}
    </div>
  );
}

function Overview() {
  const [rows, setRows] = useState(null);
  const [totals, setTotals] = useState({ students: 0, parents: 0 });
  const [move, setMove] = useState({ id: null, email: '' });
  const [msg, setMsg] = useState('');

  async function load() {
    const since = addDays(isoDay(), -30);
    const [c, m, l, a, d] = await Promise.all([
      supabase.from('classes').select('id, name, join_code, teacher:profiles(full_name)').order('name'),
      supabase.from('class_members').select('class_id, student_id'),
      supabase.from('parent_links').select('parent_id, student_id'),
      supabase.from('attendance').select('class_id, status').gte('on_date', since),
      supabase.from('activities').select('class_id, on_date').order('on_date', { ascending: false }).limit(1000),
    ]);
    const members = m.data || []; const links = l.data || []; const att = a.data || []; const acts = d.data || [];
    const linked = new Set(links.map((x) => x.student_id));
    setTotals({ students: new Set(members.map((x) => x.student_id)).size, parents: new Set(links.map((x) => x.parent_id)).size });
    setRows((c.data || []).map((cls) => {
      const st = members.filter((x) => x.class_id === cls.id);
      const ca = att.filter((x) => x.class_id === cls.id);
      const present = ca.filter((x) => x.status === 'present' || x.status === 'late').length;
      return {
        ...cls, students: st.length, withParent: st.filter((x) => linked.has(x.student_id)).length,
        rate: ca.length ? Math.round((present / ca.length) * 100) : null,
        lastPost: acts.find((x) => x.class_id === cls.id)?.on_date,
      };
    }));
  }
  useEffect(() => { load(); }, []);

  async function reassign(e) {
    e.preventDefault(); setMsg('');
    const { data, error } = await supabase.rpc('admin_reassign_class', { cid: move.id, teacher_email: move.email });
    if (error) { setMsg(errText(error)); return; }
    setMsg(t('Class moved to {name}.', { name: data })); setMove({ id: null, email: '' }); load();
  }
  function exportCsv() {
    downloadCsv(`school-overview-${isoDay()}.csv`, [
      [t('Class'), t('Teacher'), t('Students'), t('With a parent linked'), t('Attendance (30 days)'), t('Last diary post')],
      ...(rows || []).map((r) => [r.name, r.teacher?.full_name || '', r.students, r.withParent, r.rate ?? '', r.lastPost || '']),
    ]);
  }

  if (!rows) return <p className="muted">{t('Loading…')}</p>;
  return (
    <>
      <div className="tiles">
        <div className="tile"><span className="tile-n">{rows.length}</span><span>{t('Classes')}</span></div>
        <div className="tile"><span className="tile-n">{totals.students}</span><span>{t('Students')}</span></div>
        <div className="tile"><span className="tile-n">{totals.parents}</span><span>{t('Parents linked')}</span></div>
        <div className="tile"><span className="tile-n">{rows.filter((r) => r.lastPost && r.lastPost >= addDays(isoDay(), -7)).length}/{rows.length}</span><span>{t('Classes active this week')}</span></div>
      </div>
      <section className="card">
        <div className="row between wrap"><h3>{t('All classes')}</h3><button className="btn small" onClick={exportCsv}>{t('Download CSV')}</button></div>
        {msg && <p className="small" role="status">{msg}</p>}
        <div className="tablewrap">
          <table className="table">
            <thead><tr><th>{t('Class')}</th><th>{t('Teacher')}</th><th className="num">{t('Students')}</th><th className="num">{t('With a parent linked')}</th><th className="num">{t('Attendance (30 days)')}</th><th>{t('Last diary post')}</th><th></th></tr></thead>
            <tbody>{rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr>
                  <td><b>{r.name}</b><div className="small muted">{t('Code')} {r.join_code}</div></td>
                  <td>{r.teacher?.full_name || '–'}</td>
                  <td className="num">{r.students}</td>
                  <td className={'num' + (r.students && r.withParent < r.students ? ' bad' : '')}>{r.withParent}/{r.students}</td>
                  <td className={'num' + (r.rate != null && r.rate < 80 ? ' bad' : '')}>{r.rate == null ? '–' : `${r.rate}%`}</td>
                  <td>{r.lastPost ? fmtDay(r.lastPost) : '–'}</td>
                  <td><button className="btn small" onClick={() => setMove({ id: r.id, email: '' })}>{t('Change teacher')}</button></td>
                </tr>
                {move.id === r.id && (
                  <tr><td colSpan={7}>
                    <form className="row wrap" onSubmit={reassign}>
                      <input type="email" required value={move.email} onChange={(e) => setMove({ ...move, email: e.target.value })} placeholder={t('New teacher’s email')} className="grow" />
                      <button className="btn small primary">{t('Move class')}</button>
                      <button type="button" className="btn small" onClick={() => setMove({ id: null, email: '' })}>{t('Cancel')}</button>
                    </form>
                  </td></tr>
                )}
              </React.Fragment>
            ))}</tbody>
          </table>
        </div>
        <p className="muted small">{t('As admin you can see every class’s records. Only the class teacher writes the diary, attendance, marks and reports.')}</p>
      </section>
    </>
  );
}

function Staff({ me }) {
  const [list, setList] = useState(null);
  const [email, setEmail] = useState('');
  const [admin, setAdmin] = useState(false);
  const [msg, setMsg] = useState('');

  async function load() {
    const { data, error } = await supabase.rpc('admin_staff');
    if (error) setMsg(errText(error));
    setList(data || []);
  }
  useEffect(() => { load(); }, []);
  async function run(fn, args, ok) {
    setMsg('');
    const { error } = await supabase.rpc(fn, args);
    if (error) { setMsg(errText(error)); return; }
    setMsg(ok); load();
  }

  return (
    <div className="grid2">
      <section className="card">
        <h3>{t('Teachers')}</h3>
        {msg && <p className="small" role="status">{msg}</p>}
        {!list ? <p className="muted">{t('Loading…')}</p> : (
          <div className="tablewrap">
            <table className="table">
              <thead><tr><th>{t('Email')}</th><th>{t('Name')}</th><th className="num">{t('Classes')}</th><th>{t('Admin')}</th><th></th></tr></thead>
              <tbody>{list.map((s) => (
                <tr key={s.email}>
                  <td>{s.email}</td>
                  <td>{s.full_name || <span className="muted small">{t('Not signed up yet')}</span>}</td>
                  <td className="num">{s.user_id ? s.classes : '–'}</td>
                  <td><input type="checkbox" checked={s.is_admin} disabled={s.user_id === me.id}
                    onChange={(e) => run('admin_set_admin', { target_email: s.email, value: e.target.checked }, t('Saved.'))} aria-label={t('Admin')} /></td>
                  <td>{s.user_id !== me.id && <button className="btn small" onClick={() => confirm(t('Remove {email} from the teacher list?', { email: s.email })) && run('admin_remove_teacher', { old_email: s.email }, t('Removed.'))}>{t('Remove')}</button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <p className="muted small">{t('Removing an email stops new teacher sign-ups with it. Move their classes to another teacher first; to delete an existing login completely, use Supabase → Authentication.')}</p>
      </section>
      <aside className="card">
        <h3>{t('Add a teacher')}</h3>
        <form className="form" onSubmit={(e) => { e.preventDefault(); run('admin_add_teacher', { new_email: email, make_admin: admin }, t('Added. They can now create a Teacher account with this email.')); setEmail(''); setAdmin(false); }}>
          <label className="field">{t('Email')}<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="row small check"><input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} /> {t('Also make them a school admin')}</label>
          <button className="btn primary">{t('Add teacher')}</button>
        </form>
      </aside>
    </div>
  );
}

const IMG = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function School({ onSaved }) {
  const [f, setF] = useState(null);
  const [files, setFiles] = useState({ logo: null, hero: null });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    supabase.from('school_settings').select('*').eq('id', 1).maybeSingle().then(({ data }) => setF(data || {}));
  }, []);
  if (!f) return <p className="muted">{t('Loading…')}</p>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  async function upload(file) {
    const ext = IMG[file.type];
    if (!ext) throw new Error(t('Use a JPG, PNG or WebP image.'));
    if (file.size > 5 * 1024 * 1024) throw new Error(t('Images must be under 5 MB.'));
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('branding').upload(path, file, { contentType: file.type });
    if (error) throw error;
    return path;
  }
  async function save(e) {
    e.preventDefault(); setMsg(''); setBusy(true);
    try {
      const row = {
        school_name: (f.school_name || '').trim(), school_name_ta: (f.school_name_ta || '').trim(), tagline: (f.tagline || '').trim(),
        about: (f.about || '').trim(), contact_email: (f.contact_email || '').trim() || null, contact_phone: (f.contact_phone || '').trim() || null,
        address: (f.address || '').trim() || null, whatsapp_url: (f.whatsapp_url || '').trim() || null,
        logo_path: f.logo_path || null, hero_path: f.hero_path || null, updated_at: new Date().toISOString(),
      };
      if (!row.school_name) throw new Error(t('Enter the school’s name.'));
      if (row.whatsapp_url && !/^https:\/\/(chat\.whatsapp\.com|wa\.me|whatsapp\.com)\//i.test(row.whatsapp_url)) throw new Error(t('The WhatsApp link should start with https://chat.whatsapp.com/'));
      if (files.logo) row.logo_path = await upload(files.logo);
      if (files.hero) row.hero_path = await upload(files.hero);
      const { error } = await supabase.from('school_settings').update(row).eq('id', 1);
      if (error) throw error;
      const old = [files.logo && f.logo_path, files.hero && f.hero_path].filter(Boolean);
      if (old.length) await supabase.storage.from('branding').remove(old);
      setF({ ...f, ...row }); setFiles({ logo: null, hero: null });
      await loadSettings(); onSaved?.();
      setMsg(t('Saved. The website now shows these details.'));
    } catch (e2) { setMsg(errText(e2)); }
    setBusy(false);
  }

  return (
    <form className="grid2" onSubmit={save}>
      <section className="card form">
        <h3>{t('School details')}</h3>
        <label className="field">{t('School name (English)')}<input value={f.school_name || ''} onChange={set('school_name')} maxLength={120} required /></label>
        <label className="field">{t('School name (Tamil)')}<input value={f.school_name_ta || ''} onChange={set('school_name_ta')} maxLength={120} placeholder="தமிழ்ப் பள்ளி" /></label>
        <label className="field">{t('Short welcome line (home page)')}<textarea rows={2} value={f.tagline || ''} onChange={set('tagline')} maxLength={400} /></label>
        <label className="field">{t('About the school')}<textarea rows={5} value={f.about || ''} onChange={set('about')} maxLength={3000} placeholder={t('When and where classes run, year levels, history of the school…')} /></label>
        <div className="row wrap">
          <label className="field grow">{t('Contact email')}<input type="email" value={f.contact_email || ''} onChange={set('contact_email')} /></label>
          <label className="field grow">{t('Contact phone')}<input value={f.contact_phone || ''} onChange={set('contact_phone')} maxLength={40} /></label>
        </div>
        <label className="field">{t('Address (where classes are held)')}<input value={f.address || ''} onChange={set('address')} maxLength={300} /></label>
        <label className="field">{t('WhatsApp group invite link')}<input value={f.whatsapp_url || ''} onChange={set('whatsapp_url')} placeholder="https://chat.whatsapp.com/…" /></label>
      </section>
      <aside className="stack">
        <section className="card form">
          <h3>{t('Logo and photo')}</h3>
          <div className="brandprev">
            <span className="logo-mark big">{files.logo ? <img src={URL.createObjectURL(files.logo)} alt="" /> : SITE.logoUrl ? <img src={SITE.logoUrl} alt="" /> : 'அ'}</span>
            <label className="field grow">{t('Logo (square, JPG/PNG)')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFiles({ ...files, logo: e.target.files?.[0] || null })} /></label>
          </div>
          {(files.hero || SITE.heroUrl) && <img className="heroprev" src={files.hero ? URL.createObjectURL(files.hero) : SITE.heroUrl} alt="" />}
          <label className="field">{t('School photo for the home page (wide, JPG)')}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFiles({ ...files, hero: e.target.files?.[0] || null })} /></label>
          <p className="muted small">{t('Only use photos where every family has agreed to their child appearing online.')}</p>
        </section>
        {msg && <p className="card notice small" role="status">{msg}</p>}
        <button className="btn primary big" disabled={busy}>{busy ? t('Saving…') : t('Save school details')}</button>
      </aside>
    </form>
  );
}
