import { useCallback, useEffect, useState } from 'react';
import { supabase, fnErrText } from '../supabase.js';

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
        .select('class_id, student_id, classes(id, name, teacher:profiles!classes_teacher_id_fkey(full_name))').eq('student_id', profile.id);
      setState({ loading: false, classes: (data || []).map((m) => m.classes).filter(Boolean), children: [], memberships: data || [] });
    } else {
      const { data: links } = await supabase.from('parent_links')
        .select('student_id, student:profiles!parent_links_student_id_fkey(id, full_name)').eq('parent_id', profile.id);
      const kids = (links || []).map((l) => l.student).filter(Boolean).sort((a, b) => a.full_name.localeCompare(b.full_name));
      let memberships = [];
      if (kids.length) {
        const { data } = await supabase.from('class_members')
          .select('class_id, student_id, classes(id, name, teacher:profiles!classes_teacher_id_fkey(full_name))').in('student_id', kids.map((k) => k.id));
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
  if (error) throw new Error(await fnErrText(error, name));
  return data;
}

// Parents (name + phone for WhatsApp) of the given students: { studentId: [parent…] }.
export function useParents(studentIds) {
  const [map, setMap] = useState({});
  const key = studentIds.join();
  useEffect(() => {
    let off = false;
    if (!studentIds.length) { setMap({}); return; }
    supabase.from('parent_links').select('student_id, parent:profiles!parent_links_parent_id_fkey(id, full_name, phone)')
      .in('student_id', studentIds).then(({ data }) => {
        if (off) return;
        const m = {};
        (data || []).forEach((l) => { if (l.parent) (m[l.student_id] ||= []).push(l.parent); });
        setMap(m);
      });
    return () => { off = true; };
  }, [key]);
  return map;
}
