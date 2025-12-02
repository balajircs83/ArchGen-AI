import { createClient } from '@supabase/supabase-js';

// Configuration provided by user
const SUPABASE_URL = 'https://tiaycncwmiseavjnlelk.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpYXljbmN3bWlzZWF2am5sZWxrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1ODAxOTYsImV4cCI6MjA4MDE1NjE5Nn0.echwK2A4kfu3HBCeu-Xy1_YuH3CFY6Y6PkzHOyTo6oU';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);