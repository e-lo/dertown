import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321'
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'your-anon-key-here'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Database types based on our schema
export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string
          title: string
          description: string | null
          start_date: string
          end_date: string | null
          start_time: string | null
          end_time: string | null
          location_id: string | null
          organization_id: string | null
          email: string | null
          website: string | null
          registration_link: string | null
          primary_tag_id: string | null
          secondary_tag_id: string | null
          image_id: string | null
          external_image_url: string | null
          featured: boolean
          parent_event_id: string | null
          exclude_from_calendar: boolean
          google_calendar_event_id: string | null
          registration: boolean
          cost: string | null
          status: 'pending' | 'approved' | 'duplicate' | 'archived'
          source_id: string | null
          created_at: string
          updated_at: string
          details_outdated_checked_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          start_date: string
          end_date?: string | null
          start_time?: string | null
          end_time?: string | null
          location_id?: string | null
          organization_id?: string | null
          email?: string | null
          website?: string | null
          registration_link?: string | null
          primary_tag_id?: string | null
          secondary_tag_id?: string | null
          image_id?: string | null
          external_image_url?: string | null
          featured?: boolean
          parent_event_id?: string | null
          exclude_from_calendar?: boolean
          google_calendar_event_id?: string | null
          registration?: boolean
          cost?: string | null
          status?: 'pending' | 'approved' | 'duplicate' | 'archived'
          source_id?: string | null
          created_at?: string
          updated_at?: string
          details_outdated_checked_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          start_date?: string
          end_date?: string | null
          start_time?: string | null
          end_time?: string | null
          location_id?: string | null
          organization_id?: string | null
          email?: string | null
          website?: string | null
          registration_link?: string | null
          primary_tag_id?: string | null
          secondary_tag_id?: string | null
          image_id?: string | null
          external_image_url?: string | null
          featured?: boolean
          parent_event_id?: string | null
          exclude_from_calendar?: boolean
          google_calendar_event_id?: string | null
          registration?: boolean
          cost?: string | null
          status?: 'pending' | 'approved' | 'duplicate' | 'archived'
          source_id?: string | null
          created_at?: string
          updated_at?: string
          details_outdated_checked_at?: string | null
        }
      }
      locations: {
        Row: {
          id: string
          name: string
          address: string | null
          website: string | null
          phone: string | null
          latitude: number | null
          longitude: number | null
          parent_location_id: string | null
          status: 'pending' | 'approved' | 'duplicate' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          address?: string | null
          website?: string | null
          phone?: string | null
          latitude?: number | null
          longitude?: number | null
          parent_location_id?: string | null
          status?: 'pending' | 'approved' | 'duplicate' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          address?: string | null
          website?: string | null
          phone?: string | null
          latitude?: number | null
          longitude?: number | null
          parent_location_id?: string | null
          status?: 'pending' | 'approved' | 'duplicate' | 'archived'
          created_at?: string
          updated_at?: string
        }
      }
      organizations: {
        Row: {
          id: string
          name: string
          description: string | null
          website: string | null
          phone: string | null
          email: string | null
          location_id: string | null
          parent_organization_id: string | null
          status: 'pending' | 'approved' | 'duplicate' | 'archived'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          website?: string | null
          phone?: string | null
          email?: string | null
          location_id?: string | null
          parent_organization_id?: string | null
          status?: 'pending' | 'approved' | 'duplicate' | 'archived'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          website?: string | null
          phone?: string | null
          email?: string | null
          location_id?: string | null
          parent_organization_id?: string | null
          status?: 'pending' | 'approved' | 'duplicate' | 'archived'
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          name: string
          calendar_id: string | null
          share_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          calendar_id?: string | null
          share_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          calendar_id?: string | null
          share_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      announcements: {
        Row: {
          id: string
          title: string
          message: string
          link: string | null
          email: string | null
          organization_id: string | null
          author: string | null
          status: 'pending' | 'published' | 'archived'
          created_at: string
          show_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          title: string
          message: string
          link?: string | null
          email?: string | null
          organization_id?: string | null
          author?: string | null
          status?: 'pending' | 'published' | 'archived'
          created_at?: string
          show_at?: string
          expires_at?: string | null
        }
        Update: {
          id?: string
          title?: string
          message?: string
          link?: string | null
          email?: string | null
          organization_id?: string | null
          author?: string | null
          status?: 'pending' | 'published' | 'archived'
          created_at?: string
          show_at?: string
          expires_at?: string | null
        }
      }
      source_sites: {
        Row: {
          id: string
          name: string
          url: string
          organization_id: string | null
          event_tag_id: string | null
          last_scraped: string | null
          last_status: string | null
          last_error: string | null
          import_frequency: 'hourly' | 'daily' | 'weekly' | 'manual'
          extraction_function: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          url: string
          organization_id?: string | null
          event_tag_id?: string | null
          last_scraped?: string | null
          last_status?: string | null
          last_error?: string | null
          import_frequency?: 'hourly' | 'daily' | 'weekly' | 'manual'
          extraction_function?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          url?: string
          organization_id?: string | null
          event_tag_id?: string | null
          last_scraped?: string | null
          last_status?: string | null
          last_error?: string | null
          import_frequency?: 'hourly' | 'daily' | 'weekly' | 'manual'
          extraction_function?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      scrape_logs: {
        Row: {
          id: string
          source_id: string
          timestamp: string
          status: string
          error_message: string | null
        }
        Insert: {
          id?: string
          source_id: string
          timestamp?: string
          status: string
          error_message?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          timestamp?: string
          status?: string
          error_message?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      event_status: 'pending' | 'approved' | 'duplicate' | 'archived'
      import_frequency: 'hourly' | 'daily' | 'weekly' | 'manual'
      announcement_status: 'pending' | 'published' | 'archived'
    }
  }
}

// Helper functions for common database operations
export const db = {
  // Events
  events: {
    getAll: () => supabase.from('events').select('*').eq('status', 'approved').eq('exclude_from_calendar', false),
    getById: (id: string) => supabase.from('events').select('*').eq('id', id).single(),
    getFeatured: () => supabase.from('events').select('*').eq('status', 'approved').eq('featured', true),
    create: (data: Database['public']['Tables']['events']['Insert']) => supabase.from('events').insert(data),
    update: (id: string, data: Database['public']['Tables']['events']['Update']) => supabase.from('events').update(data).eq('id', id),
    delete: (id: string) => supabase.from('events').delete().eq('id', id)
  },
  
  // Locations
  locations: {
    getAll: () => supabase.from('locations').select('*').eq('status', 'approved'),
    getById: (id: string) => supabase.from('locations').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['locations']['Insert']) => supabase.from('locations').insert(data),
    update: (id: string, data: Database['public']['Tables']['locations']['Update']) => supabase.from('locations').update(data).eq('id', id),
    delete: (id: string) => supabase.from('locations').delete().eq('id', id)
  },
  
  // Organizations
  organizations: {
    getAll: () => supabase.from('organizations').select('*').eq('status', 'approved'),
    getById: (id: string) => supabase.from('organizations').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['organizations']['Insert']) => supabase.from('organizations').insert(data),
    update: (id: string, data: Database['public']['Tables']['organizations']['Update']) => supabase.from('organizations').update(data).eq('id', id),
    delete: (id: string) => supabase.from('organizations').delete().eq('id', id)
  },
  
  // Tags
  tags: {
    getAll: () => supabase.from('tags').select('*'),
    getById: (id: string) => supabase.from('tags').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['tags']['Insert']) => supabase.from('tags').insert(data),
    update: (id: string, data: Database['public']['Tables']['tags']['Update']) => supabase.from('tags').update(data).eq('id', id),
    delete: (id: string) => supabase.from('tags').delete().eq('id', id)
  },
  
  // Announcements
  announcements: {
    getPublished: () => supabase.from('announcements')
      .select('*')
      .eq('status', 'published')
      .lte('show_at', new Date().toISOString())
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString()),
    getById: (id: string) => supabase.from('announcements').select('*').eq('id', id).single(),
    create: (data: Database['public']['Tables']['announcements']['Insert']) => supabase.from('announcements').insert(data),
    update: (id: string, data: Database['public']['Tables']['announcements']['Update']) => supabase.from('announcements').update(data).eq('id', id),
    delete: (id: string) => supabase.from('announcements').delete().eq('id', id)
  }
} 