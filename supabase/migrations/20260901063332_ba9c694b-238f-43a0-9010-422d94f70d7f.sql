CREATE POLICY "settings_delete" ON public.church_settings FOR DELETE TO authenticated USING (app.has_full_access(auth.uid()));

CREATE POLICY "member_photos_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'member-photos' AND (((storage.foldername(name))[1] = (auth.uid())::text) OR app.has_full_access(auth.uid())));