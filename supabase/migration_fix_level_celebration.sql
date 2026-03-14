-- Fix: Don't post a level celebration when level is set for the first time (onboarding)
-- Only celebrate when level changes FROM one value TO a different value (both non-null)

CREATE OR REPLACE FUNCTION public.handle_level_change()
RETURNS trigger AS $$
DECLARE
  v_marjorie_id UUID;
  v_level_label TEXT;
  v_level_emoji TEXT;
BEGIN
  -- Only fire when practice_level changes from one non-null value to another
  -- This prevents the celebration post when a user first sets their level during onboarding
  IF NEW.practice_level IS DISTINCT FROM OLD.practice_level
     AND NEW.practice_level IS NOT NULL
     AND OLD.practice_level IS NOT NULL THEN

    -- Map level to French label + emoji
    CASE NEW.practice_level
      WHEN 'debutante' THEN v_level_label := 'Débutante'; v_level_emoji := '🌱';
      WHEN 'initiee' THEN v_level_label := 'Initiée'; v_level_emoji := '🌿';
      WHEN 'intermediaire' THEN v_level_label := 'Intermédiaire'; v_level_emoji := '💎';
      WHEN 'avancee' THEN v_level_label := 'Avancée'; v_level_emoji := '👑';
      ELSE v_level_label := NEW.practice_level; v_level_emoji := '⭐';
    END CASE;

    v_marjorie_id := public.get_marjorie_id();

    INSERT INTO public.community_posts (user_id, content, is_from_marjorie, is_automated,
      image_url, is_pinned, link_url, link_label, reply_to_id, reply_to_preview, reply_to_author, edited_at)
    VALUES (
      COALESCE(v_marjorie_id, NEW.id),
      v_level_emoji || ' @' || COALESCE(NEW.username, 'une membre') || ' passe au niveau ' || v_level_label || ' ! 🚀 Quelle belle progression, bravo !',
      true, true,
      null, false, null, null, null, null, null, null
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
