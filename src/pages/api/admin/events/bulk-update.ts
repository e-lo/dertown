import type { APIRoute } from 'astro';
import { supabaseAdmin } from '@/lib/supabase';
import { checkAdminAccess } from '@/lib/session';

export const prerender = false;

export const PUT: APIRoute = async ({ request, cookies }) => {
  try {
    // Check authentication
    const { isAdmin, error: authError } = await checkAdminAccess(cookies);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const requestData = await request.json();
    const { event_ids, location_added, organization_added, ...updateData } = requestData;

    if (!event_ids || !Array.isArray(event_ids) || event_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'Event IDs array is required and must not be empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let locationId: string | null = null;
    let organizationId: string | null = null;

    // Handle new location if present
    if (location_added && location_added.trim()) {
      const { data: newLocation, error: locationError } = await supabaseAdmin
        .from('locations')
        .insert({
          name: location_added.trim(),
          status: 'approved' as const,
        })
        .select()
        .single();

      if (locationError) {
        console.error('[BULK UPDATE] Location creation error:', locationError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create new location', 
          details: locationError.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (newLocation) {
        locationId = newLocation.id;
      }
    }

    // Handle new organization if present
    if (organization_added && organization_added.trim()) {
      const { data: newOrganization, error: orgError } = await supabaseAdmin
        .from('organizations')
        .insert({
          name: organization_added.trim(),
          status: 'approved' as const,
        })
        .select()
        .single();

      if (orgError) {
        console.error('[BULK UPDATE] Organization creation error:', orgError);
        return new Response(JSON.stringify({ 
          error: 'Failed to create new organization', 
          details: orgError.message 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      if (newOrganization) {
        organizationId = newOrganization.id;
      }
    }

    // Prepare update data - only include fields that are explicitly provided
    // This ensures we don't overwrite fields that weren't changed
    const cleanedData: any = {};
    
    // Track which fields were explicitly provided (not undefined)
    const providedFields = new Set<string>();
    
    for (const [key, value] of Object.entries(updateData)) {
      // Skip date fields (start_date, end_date) - these cannot be changed in bulk update
      if (key === 'start_date' || key === 'end_date') {
        continue;
      }
      
      // Skip location/organization added fields (handled separately)
      if (key === 'location_added' || key === 'organization_added') {
        continue;
      }
      
      // Only include fields that are explicitly provided (not undefined)
      // This means the field was in the request, even if it's null/empty
      if (value !== undefined) {
        providedFields.add(key);
        
        // Handle location/organization specially
        if (key === 'location_id' && locationId !== null) {
          cleanedData[key] = locationId;
        } else if (key === 'organization_id' && organizationId !== null) {
          cleanedData[key] = organizationId;
        } else {
          // Convert empty strings to null for nullable fields
          cleanedData[key] = (value === '') ? null : value;
        }
      }
    }

    // If new location/organization was created, ensure they're in the update
    if (locationId !== null) {
      cleanedData.location_id = locationId;
    }
    if (organizationId !== null) {
      cleanedData.organization_id = organizationId;
    }

    // Validate time consistency if both times are being updated
    // The database constraint will also catch this, but we validate early for better error messages
    if (cleanedData.start_time !== undefined && cleanedData.end_time !== undefined) {
      if (cleanedData.start_time !== null && cleanedData.end_time !== null) {
        // Both times are provided and not null - validate end_time > start_time
        if (cleanedData.end_time <= cleanedData.start_time) {
          return new Response(JSON.stringify({ 
            error: 'Time validation error', 
            details: 'End time must be after start time' 
          }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
    }
    
    // If no fields to update, return early
    if (Object.keys(cleanedData).length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No fields to update',
        details: 'At least one field must be provided for update'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Update all events matching the IDs
    const { data, error } = await supabaseAdmin
      .from('events')
      .update(cleanedData)
      .in('id', event_ids)
      .select(`
        *,
        primary_tag:tags!events_primary_tag_id_fkey(name),
        secondary_tag:tags!events_secondary_tag_id_fkey(name),
        location:locations!events_location_id_fkey(name, address),
        organization:organizations!events_organization_id_fkey(name)
      `);

    if (error) {
      console.error('[BULK UPDATE] Error updating events:', error);
      return new Response(JSON.stringify({ error: 'Failed to update events', details: error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      events: data || [], 
      count: data?.length || 0,
      updated: data?.length || 0
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[BULK UPDATE] Unexpected error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

