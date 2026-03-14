-- ── RLS policies for direct_messages ──────────────────────────────────────────
-- Users can see messages where they are sender or receiver

-- SELECT: users can read their own conversations
CREATE POLICY "Users can view own DMs"
  ON direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- INSERT: users can send messages (as sender)
CREATE POLICY "Users can send DMs"
  ON direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- UPDATE: users can update their own sent messages (edit, pin) or mark received as read
CREATE POLICY "Users can update own DMs"
  ON direct_messages FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- DELETE: users can delete their own sent messages
CREATE POLICY "Users can delete own DMs"
  ON direct_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- ── RLS policies for dm_archived_conversations ──────────────────────────────
-- (if RLS is enabled on this table too)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'dm_archived_conversations' AND rowsecurity = true) THEN
    EXECUTE 'CREATE POLICY "Users can manage own archives" ON dm_archived_conversations FOR ALL USING (auth.uid() = admin_id)';
  END IF;
END $$;
