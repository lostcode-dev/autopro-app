ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS mobile_phone varchar(20),
  ADD COLUMN IF NOT EXISTS birth_date date;

COMMENT ON COLUMN public.clients.mobile_phone IS 'Numero de celular do cliente.';
COMMENT ON COLUMN public.clients.birth_date IS 'Data de nascimento do cliente PF.';
