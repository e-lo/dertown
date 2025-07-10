import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env.local first, then .env
dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing Supabase environment variables');
  console.error('Please create a .env.local file with:');
  console.error('SUPABASE_URL=http://127.0.0.1:54321');
  console.error('SUPABASE_ANON_KEY=your-anon-key-here');
  console.error('');
  console.error('Or set these environment variables directly.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function validateThemeColors() {
  console.log('🎨 Validating theme colors for all tags...');
  
  // Fetch all tags from the database
  const { data: tags, error } = await supabase
    .from('tags')
    .select('name');
  
  if (error) {
    console.error('❌ Error fetching tags:', error);
    process.exit(1);
  }

  if (!tags || tags.length === 0) {
    console.warn('⚠️ No tags found in database');
    return;
  }

  // Read theme.css content
  const themeCssPath = path.join(__dirname, '../src/styles/theme.css');
  const cssContent = fs.readFileSync(themeCssPath, 'utf8');

  let hasError = false;
  const missingColors: string[] = [];

  // Check each tag has a corresponding color
  tags.forEach(tag => {
    const kebabName = tag.name.toLowerCase().replace(/\s+/g, '-');
    const className = `.bg-category-${kebabName}`;
    
    // Check if we have a CSS class for this tag
    if (!cssContent.includes(className)) {
      hasError = true;
      missingColors.push(tag.name);
    }
  });

  if (hasError) {
    console.error('❌ Missing theme colors for the following tags:');
    missingColors.forEach(tag => {
      console.error(`  - ${tag}`);
    });
    console.error('\nPlease add these colors to src/styles/theme.css');
    process.exit(1);
  }

  console.log('✅ All tags have corresponding theme colors');
}

// Run validation
validateThemeColors().catch(error => {
  console.error('❌ Validation failed:', error);
  process.exit(1);
}); 