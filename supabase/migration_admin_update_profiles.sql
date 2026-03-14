-- Allow admins to update any profile (needed for bilans date picker, level changes, etc.)
CREATE POLICY "Admins can update all profiles"
  ON profiles
  FOR UPDATE
  USING (public.is_admin());
