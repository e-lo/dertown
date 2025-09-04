// test-supabase.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Decide which Supabase credentials to use based on USE_LOCAL_DB
const useLocalDb = process.env.USE_LOCAL_DB === 'true';

const supabaseUrl = useLocalDb
  ? 'http://127.0.0.1:54321'
  : process.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = useLocalDb
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'
  : process.env.SUPABASE_SERVICE_ROLE_KEY;

// Log the loaded variables for debugging, without exposing the full key
console.log(`--- Supabase Connection Test ---`);
console.log(`USE_LOCAL_DB: ${useLocalDb}`);
console.log(`Loaded PUBLIC_SUPABASE_URL: ${supabaseUrl}`);
if (supabaseServiceKey) {
  console.log(
    `Loaded SUPABASE_SERVICE_ROLE_KEY: ${supabaseServiceKey.substring(
      0,
      10
    )}...${supabaseServiceKey.substring(supabaseServiceKey.length - 10)}`
  );
} else {
  console.log('Loaded SUPABASE_SERVICE_ROLE_KEY: Not found');
}

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    'Error: Make sure the required Supabase environment variables are set in your .env file.'
  );
  process.exit(1);
}

// Initialize the Supabase client with the service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

async function testFetchTags() {
  console.log('Attempting to fetch tags with the service role key...');

  const { data, error } = await supabaseAdmin.from('tags').select('*');

  if (error) {
    console.error('An error occurred:');
    console.error(error);
    console.log(
      '\nTest Failed: The key is likely incorrect or there is a network issue.'
    );
  } else if (data && data.length > 0) {
    console.log('Success! Fetched tags:');
    console.log(data.map(tag => ({ id: tag.id, name: tag.name })));
    console.log(`\nTest Passed: Your SUPABASE_SERVICE_ROLE_KEY is working correctly.`);
  } else {
    console.log('Test Succeeded, but no tags were returned. The table might be empty.');
  }
}

testFetchTags(); 