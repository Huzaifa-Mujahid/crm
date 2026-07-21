-- Enable Row Level Security
ALTER TABLE public.client_payment_methods ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Enable read access for authenticated users" ON public.client_payment_methods
    FOR SELECT
    TO authenticated
    USING (true);

-- Allow insert access to authenticated users
CREATE POLICY "Enable insert access for authenticated users" ON public.client_payment_methods
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Allow update access to authenticated users
CREATE POLICY "Enable update access for authenticated users" ON public.client_payment_methods
    FOR UPDATE
    TO authenticated
    USING (true);

-- Allow delete access to authenticated users
CREATE POLICY "Enable delete access for authenticated users" ON public.client_payment_methods
    FOR DELETE
    TO authenticated
    USING (true);
