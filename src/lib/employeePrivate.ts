import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

/**
 * Sensitive employee data lives in its own table (employee_private_details) that
 * no client may read directly — every read and write goes through audited RPCs
 * that only the employee themselves or a user with the `hr` role may call.
 */
export interface EmployeePrivate {
  date_of_birth: string | null;
  medical_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relation: string | null;
  emergency_contact2_name: string | null;
  emergency_contact2_phone: string | null;
  clothing_size: string | null;
  shoe_size: string | null;
  drivers_license: string | null;
  employment_start_date: string | null;
  employment_end_date: string | null;
}

export const EMPLOYEE_PRIVATE_FIELDS = [
  'date_of_birth',
  'medical_notes',
  'emergency_contact_name',
  'emergency_contact_phone',
  'emergency_contact_relation',
  'emergency_contact2_name',
  'emergency_contact2_phone',
  'clothing_size',
  'shoe_size',
  'drivers_license',
  'employment_start_date',
  'employment_end_date',
] as const;

export const emptyEmployeePrivate = (): EmployeePrivate =>
  Object.fromEntries(EMPLOYEE_PRIVATE_FIELDS.map((f) => [f, null])) as unknown as EmployeePrivate;

const nullish = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : (v as string | null) ?? null);

export async function loadEmployeePrivate(
  profileId: string,
  reason?: string,
): Promise<{ data: EmployeePrivate | null; error?: string }> {
  const { data, error } = await supabase.rpc('get_employee_private_details', {
    _profile_id: profileId,
    _reason: reason ?? null,
  });
  if (error) return { data: null, error: error.message };
  const row = (Array.isArray(data) ? data[0] : data) as Partial<EmployeePrivate> | null;
  if (!row || !('date_of_birth' in row)) return { data: emptyEmployeePrivate() };
  return { data: { ...emptyEmployeePrivate(), ...row } as EmployeePrivate };
}

export async function saveEmployeePrivate(
  profileId: string,
  values: Partial<EmployeePrivate>,
  reason?: string,
): Promise<{ error?: string }> {
  const { error } = await supabase.rpc('upsert_employee_private_details', {
    _profile_id: profileId,
    _date_of_birth: nullish(values.date_of_birth),
    _medical_notes: nullish(values.medical_notes),
    _emergency_contact_name: nullish(values.emergency_contact_name),
    _emergency_contact_phone: nullish(values.emergency_contact_phone),
    _emergency_contact_relation: nullish(values.emergency_contact_relation),
    _emergency_contact2_name: nullish(values.emergency_contact2_name),
    _emergency_contact2_phone: nullish(values.emergency_contact2_phone),
    _clothing_size: nullish(values.clothing_size),
    _shoe_size: nullish(values.shoe_size),
    _drivers_license: nullish(values.drivers_license),
    _employment_start_date: nullish(values.employment_start_date),
    _employment_end_date: nullish(values.employment_end_date),
    _reason: reason ?? null,
  });
  return error ? { error: error.message } : {};
}

export async function deleteEmployeePrivate(profileId: string, reason?: string) {
  const { error } = await supabase.rpc('delete_employee_private_details', {
    _profile_id: profileId,
    _reason: reason ?? null,
  });
  return error ? { error: error.message } : {};
}

/** True when the signed-in user holds the dedicated HR role. */
export function useHrAccess() {
  const { user } = useAuth();
  const [isHr, setIsHr] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!user) {
      setIsHr(false);
      setChecked(true);
      return;
    }
    supabase
      .rpc('has_role', { _user_id: user.id, _role: 'hr' })
      .then(({ data }) => {
        if (cancelled) return;
        setIsHr(data === true);
        setChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return { isHr, checked };
}
