import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const missingConfig = !url || !key

// A placeholder client keeps imports working so App can show a setup message instead of a blank page.
export const supabase = createClient(url || 'http://localhost', key || 'missing-key')
