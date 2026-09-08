-- Bucket público para comprobantes de gastos, comprobantes de pago y el QR de suscripción.
insert into storage.buckets (id, name, public)
values ('comprobantes', 'comprobantes', true)
on conflict (id) do nothing;

-- Cada usuario solo puede subir dentro de su propia carpeta (path = "{user_id}/archivo").
create policy "usuarios suben sus propios comprobantes"
on storage.objects for insert to authenticated
with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = auth.uid()::text);

-- Solo el super_admin puede subir/actualizar el QR de pago (carpeta "qr/").
create policy "admin sube qr de pago"
on storage.objects for insert to authenticated
with check (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = 'qr' and public.is_super_admin());

create policy "admin actualiza qr de pago"
on storage.objects for update to authenticated
using (bucket_id = 'comprobantes' and (storage.foldername(name))[1] = 'qr' and public.is_super_admin());

-- Lectura pública (el bucket ya es público, esto lo hace explícito para acceso vía API).
create policy "lectura publica de comprobantes"
on storage.objects for select
using (bucket_id = 'comprobantes');
