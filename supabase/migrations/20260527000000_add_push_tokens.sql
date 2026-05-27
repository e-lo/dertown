-- Create push_tokens table for Expo push notification registration
CREATE TABLE push_tokens (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  token text UNIQUE NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android')),
  created_at timestamptz DEFAULT now() NOT NULL,
  last_seen_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS — service role bypasses it automatically
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- Allow any client to upsert their token (no auth required)
CREATE POLICY "Anyone can register push token"
  ON push_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update their push token"
  ON push_tokens FOR UPDATE
  USING (true);
