-- Add RLS policies to block direct writes to events table
-- Edge functions use service role which bypasses RLS, so these only affect client-side access

-- Block direct inserts to events table (only service role should insert)
CREATE POLICY "Block direct writes to events"
    ON public.events FOR INSERT
    WITH CHECK (false);

-- Block direct updates to events table
CREATE POLICY "Block direct updates to events"
    ON public.events FOR UPDATE
    USING (false);

-- Block direct deletes to events table
CREATE POLICY "Block direct deletes to events"
    ON public.events FOR DELETE
    USING (false);

-- Block direct inserts to events_raw table (only service role should insert)
CREATE POLICY "Block direct writes to events_raw"
    ON public.events_raw FOR INSERT
    WITH CHECK (false);

-- Block direct updates to events_raw table
CREATE POLICY "Block direct updates to events_raw"
    ON public.events_raw FOR UPDATE
    USING (false);

-- Block direct deletes to events_raw table
CREATE POLICY "Block direct deletes to events_raw"
    ON public.events_raw FOR DELETE
    USING (false);