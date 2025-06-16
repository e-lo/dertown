import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'http://127.0.0.1:54321'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSupabase() {
  console.log('🧪 Testing Supabase Setup...\n')

  try {
    // Test 1: Public read access to approved events
    console.log('1. Testing public read access to approved events...')
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('status', 'approved')
      .limit(5)
    
    if (eventsError) {
      console.log('❌ Error reading events:', eventsError.message)
    } else {
      console.log(`✅ Successfully read ${events.length} approved events`)
      if (events.length > 0) {
        console.log(`   Sample event: ${events[0].title}`)
      }
    }

    // Test 2: Public read access to tags
    console.log('\n2. Testing public read access to tags...')
    const { data: tags, error: tagsError } = await supabase
      .from('tags')
      .select('*')
      .limit(5)
    
    if (tagsError) {
      console.log('❌ Error reading tags:', tagsError.message)
    } else {
      console.log(`✅ Successfully read ${tags.length} tags`)
      if (tags.length > 0) {
        console.log(`   Sample tags: ${tags.map(t => t.name).join(', ')}`)
      }
    }

    // Test 3: Public read access to published announcements
    console.log('\n3. Testing public read access to published announcements...')
    const { data: announcements, error: announcementsError } = await supabase
      .from('announcements')
      .select('*')
      .eq('status', 'published')
      .limit(5)
    
    if (announcementsError) {
      console.log('❌ Error reading announcements:', announcementsError.message)
    } else {
      console.log(`✅ Successfully read ${announcements.length} published announcements`)
      if (announcements.length > 0) {
        console.log(`   Sample announcement: ${announcements[0].title}`)
      }
    }

    // Test 4: Storage bucket access
    console.log('\n4. Testing storage bucket access...')
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets()
    
    if (bucketsError) {
      console.log('❌ Error listing buckets:', bucketsError.message)
    } else {
      console.log(`✅ Successfully listed ${buckets.length} storage buckets`)
      const eventAssetsBucket = buckets.find(b => b.name === 'event-assets')
      if (eventAssetsBucket) {
        console.log('   ✅ event-assets bucket found')
      } else {
        console.log('   ❌ event-assets bucket not found')
      }
    }

    // Test 5: Public event submission (should go to events_staged)
    console.log('\n5. Testing public event submission to events_staged...')
    const testEvent = {
      title: 'Test Event - ' + new Date().toISOString(),
      description: 'This is a test event for validation',
      start_date: '2024-12-25',
      status: 'pending'
    }
    
    const { data: newEvent, error: insertError } = await supabase
      .from('events_staged')
      .insert(testEvent)
      .select()
    
    if (insertError) {
      console.log('❌ Error inserting test event into events_staged:', insertError.message)
    } else {
      console.log('✅ Successfully inserted test event into events_staged')
      console.log(`   Event ID: ${newEvent[0].id}`)
      
      // Clean up test event
      await supabase.from('events_staged').delete().eq('id', newEvent[0].id)
      console.log('   ✅ Test event cleaned up from events_staged')
    }

    // Test 6: File upload to event-assets bucket
    console.log('\n6. Testing file upload to event-assets bucket...')
    const fileContent = 'Hello Der Town!';
    const file = new Blob([fileContent], { type: 'text/plain' });
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('event-assets')
      .upload('test.txt', file, { upsert: true });

    if (uploadError) {
      console.log('❌ Error uploading file:', uploadError.message)
    } else {
      console.log('✅ Successfully uploaded file to event-assets bucket')
      // Clean up test file
      await supabase.storage.from('event-assets').remove(['test.txt'])
      console.log('   ✅ Test file cleaned up')
    }

    console.log('\n🎉 All tests completed!')

  } catch (error) {
    console.error('❌ Test failed with error:', error)
  }
}

testSupabase() 