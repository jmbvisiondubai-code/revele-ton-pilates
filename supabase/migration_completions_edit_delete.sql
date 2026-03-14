-- Allow users to update and delete their own course completions
CREATE POLICY "Users can update own completions" ON course_completions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own completions" ON course_completions FOR DELETE USING (auth.uid() = user_id);
