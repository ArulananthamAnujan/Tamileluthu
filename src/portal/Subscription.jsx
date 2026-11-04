import React, { useEffect, useState } from 'react';
import { supabase, errText } from '../supabase.js';
import { callFn } from '../lib/scope.js';
import { money, fmtDay } from '../lib/util.js';
import { t, getLang } from '../i18n.js';
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

// The plans the admin has set up (Admin → Subscriptions), cheapest first.
export function usePlans() {
  const [plans, setPlans] = useState(null);
  useEffect(() => {
    supabase.from('sub_plans').select('*').eq('active', true).order('sort').order('price_cents')
      .then(({ data, error }) => setPlans(error ? [] : data || []));
  }, []);
  return plans;
}
const planName = (p) => (getLang() === 'ta' && p.name_ta ? p.name_ta : p.name);

// Monthly access to தமிழ் திருத்தி for one student (shown to the student, or to a parent per child).
export function PlanCard({ student, self, compact }) {
  const [acc, reload] = useAccess(student.id);
  const plans = usePlans();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [changing, setChanging] = useState(false);
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

  async function go(fn, plan) {
    setBusy(plan ? `${fn}:${plan.id}` : fn); setMsg('');
    try {
      const r = await callFn(fn, { student_id: student.id, ...(plan ? { plan_id: plan.id } : {}) });
      if (r.already) { setMsg(t('This plan is already active.')); reload(); }
      else if (r.changed) { setMsg(t('Plan changed to {plan}. Stripe charges or credits the difference for the rest of this month.', { plan: planName(plan) })); setChanging(false); reload(); }
      else if (r.url) { window.location.href = r.url; return; }
    } catch (e) { setMsg(t(errText(e))); }
    setBusy('');
  }
  function change(plan) {
    if (!confirm(t('Change to the {plan} plan ({price} a month, {n} checks)? The new allowance starts now, and Stripe charges or credits the difference for the rest of this month.',
      { plan: planName(plan), price: money(plan.price_cents, acc.currency), n: plan.checks_per_month }))) return;
    go('subscribe-checkout', plan);
  }

  if (!acc || !plans) return <section className="card plan"><p className="muted">{t('Loading…')}</p></section>;
  if (acc.error) return <section className="card plan"><p className="muted">{t('Subscriptions are not set up yet.')}</p></section>;
  const name = self ? t('You') : student.full_name;

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
  const current = plans.find((p) => p.id === acc.plan_id);
  const card = acc.active && acc.status !== 'manual';

  // Plan cards: subscribe (not subscribed / paid at school) or switch (card subscribers).
  const choices = (
    <div className="plans">
      {plans.map((p, i) => {
        const mine = acc.active && acc.plan_id === p.id;
        const perCheck = money(Math.round(p.price_cents / p.checks_per_month), acc.currency);
        return (
          <div key={p.id} className={'plan-opt' + (mine ? ' mine' : '') + (i === 1 && plans.length > 2 ? ' best' : '')}>
            {i === 1 && plans.length > 2 && <span className="plan-tag">{t('Popular')}</span>}
            <b className="plan-opt-name">{planName(p)}</b>
            <span className="plan-opt-price">{money(p.price_cents, acc.currency)}<small> / {t('month')}</small></span>
            <span className="plan-opt-n">{t('{n} checks a month', { n: p.checks_per_month })}</span>
            <span className="small muted">{t('{price} per check', { price: perCheck })}</span>
            {mine ? <span className="plan-badge on">{t('Your plan')}</span>
              : <button className={'btn ' + (card ? '' : 'gold')} disabled={!!busy}
                  onClick={() => (card ? change(p) : go('subscribe-checkout', p))}>
                  {busy === `subscribe-checkout:${p.id}` ? t('Please wait…') : card ? t('Switch to {plan}', { plan: planName(p) }) : t('Choose {plan}', { plan: planName(p) })}
                </button>}
          </div>
        );
      })}
    </div>
  );

  return (
    <section className={'card plan' + (acc.active ? ' active' : '')}>
      <div className="row between wrap">
        <div>
          <span className={'plan-badge' + (acc.active ? ' on' : '')}>{status}</span>
          <h3>தமிழ் திருத்தி · {student.full_name}</h3>
        </div>
        {acc.active && current && <div className="plan-price">{planName(current)} · {money(current.price_cents, acc.currency)} / {t('month')}</div>}
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
          {acc.quota > 0 && acc.used >= acc.quota && <p className="small bad">{t('All checks for this month are used. Choose a bigger plan to keep checking now, or wait for next month.')}</p>}
          {!compact && (
            <div className="row wrap">
              {card && <button className="btn" disabled={!!busy} onClick={() => go('billing-portal')}>{busy === 'billing-portal' ? t('Please wait…') : t('Manage, change card or cancel')}</button>}
              {plans.length > 1 && <button className="btn" onClick={() => setChanging(!changing)}>{card ? t('Change plan') : t('Pay by card instead')}</button>}
            </div>
          )}
          {!compact && changing && choices}
        </>
      ) : (
        <>
          {acc.trial_left > 0 && <p className="small okc">{self ? t('You have {n} free trial checks left.', { n: acc.trial_left }) : t('{name} still has {n} free trial checks.', { name, n: acc.trial_left })}</p>}
          <p className="small">{t('Choose a monthly plan. Every plan includes line-by-line corrections, an examiner-style mark and a model rewrite, and teachers and parents see the feedback too. Cancel any time.')}</p>
          {plans.length ? choices : <p className="muted">{t('Subscriptions are not set up yet.')}</p>}
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
