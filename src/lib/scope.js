import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabase.js';

// Who and what the signed-in person can look at.
//   teacher → their classes (one selected at a time)
//   student → their own classes
//   parent  → their linked children (one selected) and that child's classes
export function useScope(profile) {
  const [state, setState] = useState({ loading: true, classes: [], children: [], memberships: [] });

  const load = useCallback(async () => {
    if (profile.role === 'teacher') {
      const { data } = await supabase.from('classes').select('*').eq('teacher_id', profile.id).order('created_at');
      setState({ loading: false, classes: data || [], children: [], memberships: [] });
    } else if (profile.role === 'student') {
      const { data } = await supabase.from('class_members')
        .select('class_id, student_id, classes(id, name, teacher:profiles(full_name))').eq('student_id', profile.id);
      setState({ loading: false, classes: (data || []).map((m) => m.classes).filter(Boolean), children: [], memberships: data || [] });
    } else {
      const { data: links } = await supabase.from('parent_links')
        .select('student_id, student:profiles!parent_links_student_id_fkey(id, full_name)').eq('parent_id', profile.id);
      const kids = (links || []).map((l) => l.student).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name));
      let memberships = [];
      if (kids.length) {
        const { data } = await supabase.from('class_members')
          .select('class_id, student_id, classes(id, name, teacher:profiles(full_name))').in('student_id', kids.map((k) => k.id));
        memberships = data || [];
      }
      const seen = new Map();
      memberships.forEach((m) => m.classes && seen.set(m.class_id, m.classes));
      setState({ loading: false, classes: [...seen.values()], children: kids, memberships });
    }
  }, [profile.id, profile.role]);

  useEffect(() => { load(); }, [load]);
  return { ...state, reload: load };
}

// Students in a class, sorted by name (teacher view).
export function useRoster(classId) {
  const [roster, setRoster] = useState([]);
  useEffect(() => {
    let off = false;
    if (!classId) { setRoster([]); return; }
    supabase.from('class_members').select('student_id, student:profiles(id, full_name)').eq('class_id', classId)
      .then(({ data }) => {
        if (off) return;
        setRoster((data || []).map((m) => m.student).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name)));
      });
    return () => { off = true; };
  }, [classId]);
  return roster;
}

export async function callFn(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try { const j = await error.context?.json(); if (j?.error) msg = j.error; } catch { /* keep message */ }
    throw new Error(msg);
  }
  return data;
}
