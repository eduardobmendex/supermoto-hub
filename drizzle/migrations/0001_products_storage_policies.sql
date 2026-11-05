create policy "public read products files" on storage.objects for select using (bucket_id='products');
create policy "admin insert products files" on storage.objects for insert to authenticated with check (bucket_id='products' and public.has_role(auth.uid(),'admin'));
create policy "admin update products files" on storage.objects for update to authenticated using (bucket_id='products' and public.has_role(auth.uid(),'admin'));
create policy "admin delete products files" on storage.objects for delete to authenticated using (bucket_id='products' and public.has_role(auth.uid(),'admin'));