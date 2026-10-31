import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { callFn } from '../lib/scope.js';
import { money, fmtDay } from '../lib/util.js';
import { t } from '../i18n.js';
import { SITE } from '../site.js';
import Icon from '../components/Icon.jsx';

export function useAccess(studentId) {
  const [acc, setAcc] = useState(null);
  const load = async () => {
    if (!studentId) { setAcc(null); return null; }
    const { data, error } = await supabase.rpc('my_check_access', { sid: studentId });
    const v = error ? { error: true } : data;
    setAcc(v);
    return v;
  };
  useEffect(() => { load(); }, [studentId]);
  return [acc, load];
}

// Monthly access to தமிழ் திருத்தி for one student (shown to the student, or to a parent per child).
export function PlanCard({ student, self, compact }) {
  const [acc, reload] = useAccess(student.id);
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const paidReturn = /[?&]paid=1/.test(window.location.hash);

  // Back from Stripe: the webhook can take a few seconds.
  useEffect(() => {
    if (!paidReturn) return;
    let n = 0;
    setMsg(t('Payment received — switching on access…'));
    const timer = setInterval(async () => {
      n++;
      const v = await reload();
      if (v?.active) { clearInterval(timer); setMsg(t('Thank you! The writing checker is switched on.')); }
      else if (n > 15) { clearInterval(timer); setMsg(t('Payment is still being confirmed. Refresh in a minute, or contact the school if it does not appear.')); }
    }, 2000);
    return () => clearInterval(timer);
  }, [paidReturn]);

  async function go(fn) {
    setBusy(fn); setMsg('');
    try {
      const r = await callFn(fn, { student_id: student.id });
      if (r.already) { setMsg(t('This subscription is already active.')); reload(); }
      else if (r.url) { window.location.href = r.url; return; }
    } catch (e) { setMsg(t(errText(e))); }
    setBusy('');
  }

  if (!acc) return <section className="card plan"><p className="muted">{t('Loading…')}</p></section>;
  if (acc.error) return <section className="card plan"><p className="muted">{t('Subscriptions are not set up yet.')}</p></section>;
  const name = self ? t('You') : student.full_name;
  const price = `${money(acc.price_cents, acc.currency)} / ${t('month')}`;

  if (!acc.required) {
    return (
      <section className="card plan free">
        <span className="plan-badge on">{t('Free')}</span>
        <h3>தமிழ் திருத்தி · {student.full_name}</h3>
        <p className="small">{t('The writing checker is free at this school. No subscription is needed.')}</p>
      </section>
    );
  }
  const status = acc.active
    ? (acc.status === 'manual' ? t('Paid at school') : acc.status === 'past_due' ? t('Payment problem') : t('Active'))
    : t('Not subscribed');

  return (
    <section className={'card plan' + (acc.active ? ' active' : '')}>
      <div className="row between wrap">
        <div>
          <span className={'plan-badge' + (acc.active ? ' on' : '')}>{status}</span>
          <h3>தமிழ் திருத்தி · {student.full_name}</h3>
        </div>
        <div className="plan-price">{price}</div>
      </div>
      {acc.active ? (
        <>
          <p className="small">{acc.period_end ? t('Access until {date}.', { date: fmtDay(acc.period_end.slice(0, 10), { day: 'numeric', month: 'long', year: 'numeric' }) }) : ''}
            {acc.status === 'active' ? ` ${t('Renews automatically each month.')}` : ''}</p>
          {acc.status === 'past_due' && <p className="small bad">{t('The last payment did not go through. Update the card to keep access.')}</p>}
          {acc.quota > 0 && (
            <div className="quota">
              <div className="quota-bar"><i style={{ width: `${Math.min(100, (acc.used / acc.quota) * 100)}%` }} /></div>
              <span className="small muted">{t('{a} of {b} checks used this month', { a: acc.used, b: acc.quota })}</span>
            </div>
          )}
          {!compact && (
            <div className="row wrap">
              {acc.status !== 'manual' && <button className="btn" disabled={!!busy} onClick={() => go('billing-portal')}>{busy === 'billing-portal' ? t('Please wait…') : t('Manage, change card or cancel')}</button>}
              {acc.status === 'manual' && <button className="btn" disabled={!!busy} onClick={() => go('subscribe-checkout')}>{t('Switch to monthly card payment')}</button>}
            </div>
          )}
        </>
      ) : (
        <>
          <ul className="plan-points small">
            <li><Icon name="check" size={15} stroke={2.4} />{t('Photograph any page of Tamil writing and get every mistake corrected with the rule')}</li>
            <li><Icon name="check" size={15} stroke={2.4} />{acc.quota > 0 ? t('{n} checks every month', { n: acc.quota }) : t('Unlimited checks')}</li>
            <li><Icon name="check" size={15} stroke={2.4} />{t('Teachers and parents see the feedback too')}</li>
            <li><Icon name="check" size={15} stroke={2.4} />{t('Cancel any time')}</li>
          </ul>
          {acc.trial_left > 0 && <p className="small okc">{t('{name} still has {n} free trial checks.', { name, n: acc.trial_left })}</p>}
          <div className="row wrap">
            <button className="btn gold big" disabled={!!busy} onClick={() => go('subscribe-checkout')}>{busy ? t('Please wait…') : t('Subscribe for {price}', { price })}</button>
          </div>
          <p className="small muted">{t('Secure card payment by Stripe. Prefer to pay the school in cash or by bank transfer? Ask the school office and they will switch it on.')}{SITE.contactEmail ? ` ${SITE.contactEmail}` : ''}</p>
        </>
      )}
      {msg && <p className="small" role="status">{msg}</p>}
    </section>
  );
}

export default function Subscription({ ctx }) {
  const { role, profile, scope } = ctx;
  return (
    <div className="stack">
      <div className="row between wrap"><h2 className="title">{t('Subscription')} <span className="ta">· சந்தா</span></h2></div>
      {role === 'student' && <PlanCard student={profile} self />}
      {role === 'parent' && (scope.children.length
        ? scope.children.map((k) => <PlanCard key={k.id} student={k} />)
        : <section className="card"><p className="muted">{t('Link your child first (My account → Link child), then subscribe for them here.')}</p></section>)}
      {role === 'teacher' && <section className="card"><p>{t('Teachers use the writing checker free of charge. The school admin manages prices and student access under Admin → Subscriptions.')}</p></section>}
      <section className="card notice small">
        <h3>{t('What the subscription covers')}</h3>
        <p>{t('The subscription is for the தமிழ் திருத்தி writing checker, which costs the school money for every check. Homework, attendance, marks and reports stay free for every family.')}</p>
      </section>
    </div>
  );
}
