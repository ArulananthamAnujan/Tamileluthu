import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { callFn } from '../lib/scope.js';
import { money, safeUrl, go } from '../lib/util.js';
import { PRODUCT_KINDS, SITE } from '../site.js';
import { t, tl } from '../i18n.js';
import WaButton from '../components/Wa.jsx';
import { siteLink } from '../lib/wa.js';
import { iosApp } from '../lib/device.js';

const PUBLIC_COLS = 'id, title, description, author, level, kind, price_cents, currency, external_url, active, seller_id, created_at';
const EXT = { 'application/pdf': 'pdf', 'audio/mpeg': 'mp3', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx' };

// Paper shop. Works signed out (browse) and signed in (buy, download, sell).
export default function Shop({ ctx, query }) {
  const signedIn = Boolean(ctx?.profile);
  const teacher = ctx?.role === 'teacher';
  const [tab, setTab] = useState('browse');
  const [items, setItems] = useState(null);
  const [owned, setOwned] = useState({});
  const [kind, setKind] = useState('all');
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(null);
  const paid = query?.get('paid');

  async function load() {
    const { data, error } = await supabase.from('products').select(PUBLIC_COLS).eq('active', true).order('created_at', { ascending: false });
    if (error) setMsg(errText(error));
    setItems(data || []);
    if (signedIn) {
      const { data: p } = await supabase.from('purchases').select('product_id').eq('buyer_id', ctx.profile.id).eq('status', 'paid');
      setOwned(Object.fromEntries((p || []).map((x) => [x.product_id, true])));
    }
  }
  useEffect(() => { load(); }, [signedIn]);
  // Coming back from Stripe: the webhook may take a few seconds.
  useEffect(() => {
    if (!paid || !signedIn) return;
    setMsg(t('Payment received — unlocking your paper…'));
    let n = 0;
    const timer = setInterval(async () => {
      n++;
      const { data } = await supabase.from('purchases').select('status').eq('stripe_session_id', paid).maybeSingle();
      if (data?.status === 'paid') { clearInterval(timer); setMsg(t('Thank you! Your paper is under “My papers”.')); load(); setTab('mine'); }
      else if (n > 15) { clearInterval(timer); setMsg(t('Payment is still being confirmed. Refresh in a minute, or contact the school if it does not appear.')); }
    }, 2000);
    return () => clearInterval(timer);
  }, [paid, signedIn]);

  async function buy(p) {
    if (!signedIn) { go('signin?next=shop'); return; }
    setBusy(p.id); setMsg('');
    try {
      if (p.price_cents === 0) {
        const { error } = await supabase.rpc('claim_free', { pid: p.id });
        if (error) throw error;
        await download(p.id); load();
      } else {
        const r = await callFn('shop-checkout', { product_id: p.id });
        if (r.already) { setMsg(t('You already own this.')); load(); }
        else if (r.url) { window.location.href = r.url; return; }
      }
    } catch (e) { setMsg(errText(e)); }
    setBusy(null);
  }
  async function download(id) {
    const { data: p } = await supabase.from('products').select('file_path, title').eq('id', id).single();
    if (!p?.file_path) { setMsg(t('The seller has not attached a file yet.')); return; }
    const { data, error } = await supabase.storage.from('papers').createSignedUrl(p.file_path, 300, { download: p.title.replace(/[^\w஀-௿ -]+/g, '').slice(0, 80) || true });
    if (error) { setMsg(t('You do not have access to this file yet.')); return; }
    window.location.href = data.signedUrl;
  }

  const shown = (items || []).filter((p) => (kind === 'all' || p.kind === kind)
    && (!q || `${p.title} ${p.author} ${p.level} ${p.description}`.toLowerCase().includes(q.toLowerCase())));
  const mine = (items || []).filter((p) => owned[p.id]);

  return (
    <div className="stack">
      <div className="row between wrap">
        <h2 className="title">{t('Papers & resources')} <span className="ta">· வினாத்தாள்கள்</span></h2>
        {signedIn && (
          <div className="tabs">
            <button className={tab === 'browse' ? 'on' : ''} onClick={() => setTab('browse')}>{t('Browse')}</button>
            <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>{t('My papers')}</button>
            {teacher && <button className={tab === 'sell' ? 'on' : ''} onClick={() => setTab('sell')}>{t('Sell')}</button>}
          </div>
        )}
      </div>
      {msg && <p className="card notice small" role="status">{msg}</p>}
      {tab === 'sell' && teacher ? <Seller ctx={ctx} onChange={load} /> : tab === 'mine' ? (
        <section className="card">
          {!mine.length ? <p className="muted">{t('You have no papers yet. Free papers and anything you buy appear here.')}</p> : (
            <ul className="plain">{mine.map((p) => (
              <li key={p.id} className="row between wrap repitem"><span><b>{p.title}</b>{p.author ? ` · ${p.author}` : ''}</span>
                <button className="btn small primary" onClick={() => download(p.id)}>{t('Download')}</button></li>
            ))}</ul>
          )}
        </section>
      ) : (
        <>
          <div className="row wrap">
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('Search papers, authors, year level…')} aria-label={t('Search')} className="grow" />
            <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label={t('Type')}>
              <option value="all">{t('All types')}</option>
              {Object.entries(PRODUCT_KINDS).map(([k, v]) => <option key={k} value={k}>{tl(v)}</option>)}
            </select>
          </div>
          {!items ? <p className="muted">{t('Loading…')}</p> : !shown.length ? <div className="card"><p className="muted">{t('No papers yet. Check back soon.')}{SITE.contactEmail ? ` ${SITE.contactEmail}` : ''}</p></div> : (
            <div className="cards">
              {shown.map((p) => {
                const ext = safeUrl(p.external_url);
                return (
                  <article key={p.id} className="card product">
                    <div className="row between"><span className="tag">{tl(PRODUCT_KINDS[p.kind])}</span><span className="price">{money(p.price_cents, p.currency)}</span></div>
                    <h3>{p.title}</h3>
                    <p className="small muted">{[p.author && `${t('By')} ${p.author}`, p.level].filter(Boolean).join(' · ')}</p>
                    {p.description && <p className="small pre clamp">{p.description}</p>}
                    <div className="row wrap product-foot">
                      {owned[p.id] ? <button className="btn primary small" onClick={() => download(p.id)}>{t('Download')}</button>
                        : iosApp && p.price_cents ? <span className="small muted">{t('Not available in the iPhone app')}</span>
                        : ext ? <a className="btn primary small" href={ext} target="_blank" rel="noopener noreferrer">{p.price_cents ? t('Buy from author') : t('Open')} ↗</a>
                        : <button className="btn primary small" disabled={busy === p.id} onClick={() => buy(p)}>{busy === p.id ? t('Please wait…') : p.price_cents ? `${t('Buy')} ${money(p.price_cents, p.currency)}` : signedIn ? t('Get free') : t('Sign in to download')}</button>}
                      <WaButton text={`${p.title} — ${money(p.price_cents, p.currency)}\n${siteLink('shop')}`} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="muted small">{t('Payments are handled securely by Stripe. Downloads are linked to your account, so you can download again any time from “My papers”.')} <a href="#/terms">{t('Terms & refunds')}</a></p>
        </>
      )}
    </div>
  );
}

const blank = () => ({ title: '', description: '', author: '', level: '', kind: 'paper', price: '0', external_url: '', active: true, file_path: null, rights: false });

function Seller({ ctx, onChange }) {
  const [list, setList] = useState([]);
  const [sales, setSales] = useState([]);
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState(null);
  const [file, setFile] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [grant, setGrant] = useState({ id: null, email: '' });

  async function load() {
    const { data } = await supabase.from('products').select('*').eq('seller_id', ctx.profile.id).order('created_at', { ascending: false });
    setList(data || []);
    if (data?.length) {
      const { data: s } = await supabase.from('purchases').select('product_id, amount_cents, method, status').in('product_id', data.map((p) => p.id)).eq('status', 'paid');
      setSales(s || []);
    }
  }
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  async function save(e) {
    e.preventDefault(); setMsg('');
    const cents = Math.round(Number(form.price || 0) * 100);
    if (!form.title.trim()) { setMsg(t('Add a title.')); return; }
    if (!(cents >= 0) || (cents > 0 && cents < 50)) { setMsg(t('Price must be 0 (free) or at least $0.50.')); return; }
    if (form.external_url && !safeUrl(form.external_url)) { setMsg(t('Links must start with https://')); return; }
    if (!form.rights) { setMsg(t('Please confirm you have the right to share this paper.')); return; }
    setBusy(true);
    let file_path = form.file_path;
    if (file) {
      const ext = EXT[file.type];
      if (!ext) { setMsg(t('Upload a PDF, MP3, M4A, ZIP or Word (.docx) file.')); setBusy(false); return; }
      if (file.size > 50 * 1024 * 1024) { setMsg(t('Files must be under 50 MB.')); setBusy(false); return; }
      const path = `${ctx.profile.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('papers').upload(path, file, { contentType: file.type });
      if (error) { setMsg(errText(error)); setBusy(false); return; }
      if (form.file_path) await supabase.storage.from('papers').remove([form.file_path]);
      file_path = path;
    }
    const row = {
      title: form.title.trim(), description: form.description.trim(), author: form.author.trim(), level: form.level.trim(),
      kind: form.kind, price_cents: cents, currency: SITE.currency, external_url: form.external_url.trim() || null, active: form.active, file_path,
    };
    const { error } = editing
      ? await supabase.from('products').update({ ...row, updated_at: new Date().toISOString() }).eq('id', editing)
      : await supabase.from('products').insert({ ...row, seller_id: ctx.profile.id });
    setBusy(false);
    if (error) { setMsg(errText(error)); return; }
    setForm(blank()); setEditing(null); setFile(null); setMsg(t('Saved.')); load(); onChange();
  }
  async function giveAccess(e) {
    e.preventDefault(); setMsg('');
    const { data, error } = await supabase.rpc('grant_product', { pid: grant.id, buyer_email: grant.email });
    if (error) { setMsg(errText(error)); return; }
    setMsg(t('Access given to {name}.', { name: data })); setGrant({ id: null, email: '' }); load();
  }

  const total = sales.reduce((s, x) => s + (x.method === 'stripe' || x.method === 'manual' ? x.amount_cents : 0), 0);
  return (
    <div className="grid2">
      <section className="card">
        <div className="row between wrap"><h3>{t('Your items')}</h3><span className="small muted">{t('{n} sales / downloads', { n: sales.length })} · {money(total, SITE.currency)}</span></div>
        {!list.length ? <p className="muted">{t('Nothing listed yet. Add your first paper with the form.')}</p> : (
          <div className="tablewrap"><table className="table">
            <thead><tr><th>{t('Item')}</th><th className="num">{t('Price')}</th><th className="num">{t('Sold')}</th><th></th></tr></thead>
            <tbody>{list.map((p) => (
              <React.Fragment key={p.id}>
                <tr>
                  <td>{p.title}<div className="small muted">{p.active ? t('On sale') : t('Hidden')} · {p.file_path ? t('file attached') : p.external_url ? t('external link') : t('no file yet')}</div></td>
                  <td className="num">{money(p.price_cents, p.currency)}</td>
                  <td className="num">{sales.filter((s) => s.product_id === p.id).length}</td>
                  <td className="row wrap">
                    <button className="btn small" onClick={() => { setEditing(p.id); setFile(null); setForm({ ...blank(), ...p, price: (p.price_cents / 100).toFixed(2), external_url: p.external_url || '', rights: true }); }}>{t('Edit')}</button>
                    <button className="btn small" onClick={() => setGrant({ id: p.id, email: '' })}>{t('Give access')}</button>
                  </td>
                </tr>
                {grant.id === p.id && (
                  <tr><td colSpan={4}>
                    <form className="row wrap" onSubmit={giveAccess}>
                      <input type="email" required value={grant.email} onChange={(e) => setGrant({ ...grant, email: e.target.value })} placeholder={t('Buyer’s account email')} className="grow" />
                      <button className="btn small primary">{t('Give access')}</button>
                      <button type="button" className="btn small" onClick={() => setGrant({ id: null, email: '' })}>{t('Cancel')}</button>
                    </form>
                    <p className="small muted">{t('For cash or bank-transfer sales. The buyer must already have an account.')}</p>
                  </td></tr>
                )}
              </React.Fragment>
            ))}</tbody>
          </table></div>
        )}
      </section>
      <aside className="card">
        <h3>{editing ? t('Edit item') : t('List a paper')}</h3>
        <form className="form" onSubmit={save}>
          <label className="field">{t('Title')}<input value={form.title} onChange={set('title')} maxLength={200} placeholder={t('e.g. Year 12 Tamil practice exam 2')} /></label>
          <div className="row wrap">
            <label className="field">{t('Type')}<select value={form.kind} onChange={set('kind')}>{Object.entries(PRODUCT_KINDS).map(([k, v]) => <option key={k} value={k}>{tl(v)}</option>)}</select></label>
            <label className="field">{t('Price (AUD, 0 = free)')}<input type="number" min="0" step="0.05" value={form.price} onChange={set('price')} style={{ width: '7em' }} /></label>
          </div>
          <label className="field">{t('Author (yours or another teacher’s)')}<input value={form.author} onChange={set('author')} maxLength={200} /></label>
          <label className="field">{t('Level')}<input value={form.level} onChange={set('level')} maxLength={100} placeholder={t('e.g. Year 12 · VCE Units 3&4')} /></label>
          <label className="field">{t('Description')}<textarea rows={4} value={form.description} onChange={set('description')} maxLength={5000} /></label>
          <label className="field">{t('File (PDF, MP3, M4A, ZIP, DOCX · max 50 MB)')}
            <input type="file" accept=".pdf,.mp3,.m4a,.zip,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </label>
          {form.file_path && !file && <p className="small muted">{t('A file is attached. Choose a new one to replace it.')}</p>}
          <label className="field">{t('…or sell through another site (link)')}<input value={form.external_url} onChange={set('external_url')} placeholder="https://" inputMode="url" /></label>
          <label className="row small check"><input type="checkbox" checked={form.active} onChange={set('active')} /> {t('Show in the shop')}</label>
          <label className="row small check rights"><input type="checkbox" checked={form.rights} onChange={set('rights')} /> {t('I wrote this paper, or I have the author’s written permission to share or sell it. It is not an official exam paper copied from VCAA or another exam board.')}</label>
          {msg && <p className="small" role="status">{msg}</p>}
          <div className="row">
            <button className="btn primary" disabled={busy}>{busy ? t('Saving…') : editing ? t('Save') : t('List item')}</button>
            {editing && <button type="button" className="btn" onClick={() => { setEditing(null); setForm(blank()); setFile(null); }}>{t('Cancel')}</button>}
          </div>
        </form>
      </aside>
    </div>
  );
}
