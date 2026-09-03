-- item-images: users may write/read/delete only inside their own uid folder
CREATE POLICY "item images owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "item images owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "item images owner delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'item-images' AND (storage.foldername(name))[1] = auth.uid()::text);

-- claim-evidence: strictly private, owner-only write/read
CREATE POLICY "claim evidence owner insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'claim-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "claim evidence owner read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'claim-evidence' AND (storage.foldername(name))[1] = auth.uid()::text);