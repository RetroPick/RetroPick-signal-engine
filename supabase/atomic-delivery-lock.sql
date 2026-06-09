create unique index if not exists signal_deliveries_sent_unique_idx
  on public.signal_deliveries (delivery_type, delivery_key, platform)
  where status = 'sent';
