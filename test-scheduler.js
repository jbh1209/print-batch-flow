// Test script to invoke auto-scheduler
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://kgizusgqexmlfcqfjopk.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtnaXp1c2dxZXhtbGZjcWZqb3BrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ1NTQwNzAsImV4cCI6MjA2MDEzMDA3MH0.NA2wRme-L8Z15my7n8u-BCQtO4Nw2opfsX0KSLYcs-I'
)

// Invoke auto-scheduler
const { data, error } = await supabase.functions.invoke('auto-scheduler', {
  body: {
    job_id: '100fceb4-67dc-466d-a43d-d7f8749d7c52',
    job_table_name: 'production_jobs',
    trigger_reason: 'admin_expedite'
  }
})

console.log('Scheduler result:', { data, error })