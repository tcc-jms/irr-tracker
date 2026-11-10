import { createClient } from 'https://esm.sh/@supabase/supabase-js'

const supabaseUrl = 'https://vfbfoyxjhfbxquidcyts.supabase.co/rest/v1/'
const supabaseKey = 'sb_publishable_Ce36g7LdOj7vIz5S9ipHyg_K4qdFsJb'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)