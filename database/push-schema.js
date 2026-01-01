const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = 'https://kcvrllhpgxoxndzbqmiw.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtjdnJsbGhwZ3hveG5kemJxbWl3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjkxNTMyNSwiZXhwIjoyMDgyNDkxMzI1fQ.k6PtK0QVZF-Cfz9qOEnVjMhStaKfPt8BGwMHmN1RF24';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
  auth: { persistSession: false }
});

async function pushSchema() {
  console.log('Reading schema file...');
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Split into individual statements
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  console.log(`Found ${statements.length} SQL statements to execute\n`);

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    const preview = statement.substring(0, 60).replace(/\n/g, ' ');
    
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: statement + ';' });
      
      if (error) {
        // Try direct query via postgres connection
        console.log(`[${i + 1}/${statements.length}] Warning: ${preview}...`);
        console.log(`   Error: ${error.message}\n`);
      } else {
        console.log(`[${i + 1}/${statements.length}] OK: ${preview}...`);
      }
    } catch (err) {
      console.log(`[${i + 1}/${statements.length}] Error: ${preview}...`);
      console.log(`   ${err.message}\n`);
    }
  }

  console.log('\nSchema push completed!');
  console.log('Note: If there were errors, you may need to run the schema manually in Supabase SQL Editor.');
}

pushSchema().catch(console.error);




