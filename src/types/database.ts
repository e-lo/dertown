export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          operationName?: string;
          query?: string;
          variables?: Json;
          extensions?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          author: string | null;
          comments: string | null;
          created_at: string | null;
          email: string | null;
          expires_at: string | null;
          id: string;
          link: string | null;
          message: string;
          organization_id: string | null;
          show_at: string | null;
          status: Database['public']['Enums']['announcement_status'] | null;
          title: string;
        };
        Insert: {
          author?: string | null;
          comments?: string | null;
          created_at?: string | null;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          link?: string | null;
          message: string;
          organization_id?: string | null;
          show_at?: string | null;
          status?: Database['public']['Enums']['announcement_status'] | null;
          title: string;
        };
        Update: {
          author?: string | null;
          comments?: string | null;
          created_at?: string | null;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          link?: string | null;
          message?: string;
          organization_id?: string | null;
          show_at?: string | null;
          status?: Database['public']['Enums']['announcement_status'] | null;
          title?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'announcements_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      announcements_staged: {
        Row: {
          author: string | null;
          comments: string | null;
          created_at: string | null;
          email: string | null;
          expires_at: string | null;
          id: string;
          link: string | null;
          location_added: string | null;
          message: string;
          organization: string | null;
          organization_added: string | null;
          show_at: string | null;
          status: string | null;
          title: string;
        };
        Insert: {
          author?: string | null;
          comments?: string | null;
          created_at?: string | null;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          link?: string | null;
          location_added?: string | null;
          message: string;
          organization?: string | null;
          organization_added?: string | null;
          show_at?: string | null;
          status?: string | null;
          title: string;
        };
        Update: {
          author?: string | null;
          comments?: string | null;
          created_at?: string | null;
          email?: string | null;
          expires_at?: string | null;
          id?: string;
          link?: string | null;
          location_added?: string | null;
          message?: string;
          organization?: string | null;
          organization_added?: string | null;
          show_at?: string | null;
          status?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      events: {
        Row: {
          comments: string | null;
          cost: string | null;
          created_at: string | null;
          description: string | null;
          details_outdated_checked_at: string | null;
          email: string | null;
          end_date: string | null;
          end_time: string | null;
          exclude_from_calendar: boolean | null;
          external_image_url: string | null;
          featured: boolean | null;
          google_calendar_event_id: string | null;
          id: string;
          image_id: string | null;
          location_id: string | null;
          organization_id: string | null;
          parent_event_id: string | null;
          primary_tag_id: string | null;
          registration: boolean | null;
          registration_link: string | null;
          secondary_tag_id: string | null;
          source_id: string | null;
          start_date: string;
          start_time: string | null;
          status: Database['public']['Enums']['event_status'] | null;
          title: string;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          comments?: string | null;
          cost?: string | null;
          created_at?: string | null;
          description?: string | null;
          details_outdated_checked_at?: string | null;
          email?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          exclude_from_calendar?: boolean | null;
          external_image_url?: string | null;
          featured?: boolean | null;
          google_calendar_event_id?: string | null;
          id?: string;
          image_id?: string | null;
          location_id?: string | null;
          organization_id?: string | null;
          parent_event_id?: string | null;
          primary_tag_id?: string | null;
          registration?: boolean | null;
          registration_link?: string | null;
          secondary_tag_id?: string | null;
          source_id?: string | null;
          start_date: string;
          start_time?: string | null;
          status?: Database['public']['Enums']['event_status'] | null;
          title: string;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          comments?: string | null;
          cost?: string | null;
          created_at?: string | null;
          description?: string | null;
          details_outdated_checked_at?: string | null;
          email?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          exclude_from_calendar?: boolean | null;
          external_image_url?: string | null;
          featured?: boolean | null;
          google_calendar_event_id?: string | null;
          id?: string;
          image_id?: string | null;
          location_id?: string | null;
          organization_id?: string | null;
          parent_event_id?: string | null;
          primary_tag_id?: string | null;
          registration?: boolean | null;
          registration_link?: string | null;
          secondary_tag_id?: string | null;
          source_id?: string | null;
          start_date?: string;
          start_time?: string | null;
          status?: Database['public']['Enums']['event_status'] | null;
          title?: string;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'public_events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_primary_tag_id_fkey';
            columns: ['primary_tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_secondary_tag_id_fkey';
            columns: ['secondary_tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'source_sites';
            referencedColumns: ['id'];
          },
        ];
      };
      events_staged: {
        Row: {
          comments: string | null;
          cost: string | null;
          created_at: string | null;
          description: string | null;
          details_outdated_checked_at: string | null;
          email: string | null;
          end_date: string | null;
          end_time: string | null;
          exclude_from_calendar: boolean | null;
          external_image_url: string | null;
          featured: boolean | null;
          id: string;
          image_id: string | null;
          location_added: string | null;
          location_id: string | null;
          organization_added: string | null;
          organization_id: string | null;
          parent_event_id: string | null;
          primary_tag_id: string | null;
          registration: boolean | null;
          registration_link: string | null;
          secondary_tag_id: string | null;
          source_id: string | null;
          start_date: string;
          start_time: string | null;
          status: string | null;
          submitted_at: string | null;
          title: string;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          comments?: string | null;
          cost?: string | null;
          created_at?: string | null;
          description?: string | null;
          details_outdated_checked_at?: string | null;
          email?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          exclude_from_calendar?: boolean | null;
          external_image_url?: string | null;
          featured?: boolean | null;
          id?: string;
          image_id?: string | null;
          location_added?: string | null;
          location_id?: string | null;
          organization_added?: string | null;
          organization_id?: string | null;
          parent_event_id?: string | null;
          primary_tag_id?: string | null;
          registration?: boolean | null;
          registration_link?: string | null;
          secondary_tag_id?: string | null;
          source_id?: string | null;
          start_date: string;
          start_time?: string | null;
          status?: string | null;
          submitted_at?: string | null;
          title: string;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          comments?: string | null;
          cost?: string | null;
          created_at?: string | null;
          description?: string | null;
          details_outdated_checked_at?: string | null;
          email?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          exclude_from_calendar?: boolean | null;
          external_image_url?: string | null;
          featured?: boolean | null;
          id?: string;
          image_id?: string | null;
          location_added?: string | null;
          location_id?: string | null;
          organization_added?: string | null;
          organization_id?: string | null;
          parent_event_id?: string | null;
          primary_tag_id?: string | null;
          registration?: boolean | null;
          registration_link?: string | null;
          secondary_tag_id?: string | null;
          source_id?: string | null;
          start_date?: string;
          start_time?: string | null;
          status?: string | null;
          submitted_at?: string | null;
          title?: string;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_staged_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_staged_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_staged_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'events_staged';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_staged_primary_tag_id_fkey';
            columns: ['primary_tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_staged_secondary_tag_id_fkey';
            columns: ['secondary_tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_staged_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'source_sites';
            referencedColumns: ['id'];
          },
        ];
      };
      locations: {
        Row: {
          address: string | null;
          created_at: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          parent_location_id: string | null;
          phone: string | null;
          status: Database['public']['Enums']['event_status'] | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          address?: string | null;
          created_at?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          parent_location_id?: string | null;
          phone?: string | null;
          status?: Database['public']['Enums']['event_status'] | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          address?: string | null;
          created_at?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          parent_location_id?: string | null;
          phone?: string | null;
          status?: Database['public']['Enums']['event_status'] | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'locations_parent_location_id_fkey';
            columns: ['parent_location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string | null;
          description: string | null;
          email: string | null;
          id: string;
          location_id: string | null;
          name: string;
          parent_organization_id: string | null;
          phone: string | null;
          status: Database['public']['Enums']['event_status'] | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string;
          location_id?: string | null;
          name: string;
          parent_organization_id?: string | null;
          phone?: string | null;
          status?: Database['public']['Enums']['event_status'] | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          email?: string | null;
          id?: string;
          location_id?: string | null;
          name?: string;
          parent_organization_id?: string | null;
          phone?: string | null;
          status?: Database['public']['Enums']['event_status'] | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'organizations_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'organizations_parent_organization_id_fkey';
            columns: ['parent_organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      scrape_logs: {
        Row: {
          error_message: string | null;
          id: string;
          source_id: string;
          status: string;
          timestamp: string | null;
        };
        Insert: {
          error_message?: string | null;
          id?: string;
          source_id: string;
          status: string;
          timestamp?: string | null;
        };
        Update: {
          error_message?: string | null;
          id?: string;
          source_id?: string;
          status?: string;
          timestamp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'scrape_logs_source_id_fkey';
            columns: ['source_id'];
            isOneToOne: false;
            referencedRelation: 'source_sites';
            referencedColumns: ['id'];
          },
        ];
      };
      source_sites: {
        Row: {
          created_at: string | null;
          event_tag_id: string | null;
          extraction_function: string | null;
          id: string;
          import_frequency: Database['public']['Enums']['import_frequency'] | null;
          last_error: string | null;
          last_scraped: string | null;
          last_status: string | null;
          name: string;
          organization_id: string | null;
          updated_at: string | null;
          url: string;
        };
        Insert: {
          created_at?: string | null;
          event_tag_id?: string | null;
          extraction_function?: string | null;
          id?: string;
          import_frequency?: Database['public']['Enums']['import_frequency'] | null;
          last_error?: string | null;
          last_scraped?: string | null;
          last_status?: string | null;
          name: string;
          organization_id?: string | null;
          updated_at?: string | null;
          url: string;
        };
        Update: {
          created_at?: string | null;
          event_tag_id?: string | null;
          extraction_function?: string | null;
          id?: string;
          import_frequency?: Database['public']['Enums']['import_frequency'] | null;
          last_error?: string | null;
          last_scraped?: string | null;
          last_status?: string | null;
          name?: string;
          organization_id?: string | null;
          updated_at?: string | null;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'source_sites_event_tag_id_fkey';
            columns: ['event_tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'source_sites_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
        ];
      };
      tags: {
        Row: {
          calendar_id: string | null;
          created_at: string | null;
          id: string;
          name: string;
          share_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          calendar_id?: string | null;
          created_at?: string | null;
          id?: string;
          name: string;
          share_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          calendar_id?: string | null;
          created_at?: string | null;
          id?: string;
          name?: string;
          share_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      public_announcements: {
        Row: {
          created_at: string | null;
          expires_at: string | null;
          id: string | null;
          message: string | null;
          show_at: string | null;
          status: Database['public']['Enums']['announcement_status'] | null;
          title: string | null;
        };
        Insert: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string | null;
          message?: string | null;
          show_at?: string | null;
          status?: Database['public']['Enums']['announcement_status'] | null;
          title?: string | null;
        };
        Update: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string | null;
          message?: string | null;
          show_at?: string | null;
          status?: Database['public']['Enums']['announcement_status'] | null;
          title?: string | null;
        };
        Relationships: [];
      };
      public_events: {
        Row: {
          cost: string | null;
          created_at: string | null;
          description: string | null;
          end_date: string | null;
          end_time: string | null;
          exclude_from_calendar: boolean | null;
          external_image_url: string | null;
          featured: boolean | null;
          id: string | null;
          location_id: string | null;
          organization_id: string | null;
          primary_tag_id: string | null;
          registration: boolean | null;
          registration_link: string | null;
          secondary_tag_id: string | null;
          start_date: string | null;
          start_time: string | null;
          status: Database['public']['Enums']['event_status'] | null;
          title: string | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          cost?: string | null;
          created_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          exclude_from_calendar?: boolean | null;
          external_image_url?: string | null;
          featured?: boolean | null;
          id?: string | null;
          location_id?: string | null;
          organization_id?: string | null;
          primary_tag_id?: string | null;
          registration?: boolean | null;
          registration_link?: string | null;
          secondary_tag_id?: string | null;
          start_date?: string | null;
          start_time?: string | null;
          status?: Database['public']['Enums']['event_status'] | null;
          title?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          cost?: string | null;
          created_at?: string | null;
          description?: string | null;
          end_date?: string | null;
          end_time?: string | null;
          exclude_from_calendar?: boolean | null;
          external_image_url?: string | null;
          featured?: boolean | null;
          id?: string | null;
          location_id?: string | null;
          organization_id?: string | null;
          primary_tag_id?: string | null;
          registration?: boolean | null;
          registration_link?: string | null;
          secondary_tag_id?: string | null;
          start_date?: string | null;
          start_time?: string | null;
          status?: Database['public']['Enums']['event_status'] | null;
          title?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_location_id_fkey';
            columns: ['location_id'];
            isOneToOne: false;
            referencedRelation: 'locations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_organization_id_fkey';
            columns: ['organization_id'];
            isOneToOne: false;
            referencedRelation: 'organizations';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_primary_tag_id_fkey';
            columns: ['primary_tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_secondary_tag_id_fkey';
            columns: ['secondary_tag_id'];
            isOneToOne: false;
            referencedRelation: 'tags';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Functions: {
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      announcement_status: 'pending' | 'published' | 'archived';
      event_status: 'pending' | 'approved' | 'duplicate' | 'archived';
      import_frequency: 'hourly' | 'daily' | 'weekly' | 'manual';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  storage: {
    Tables: {
      buckets: {
        Row: {
          allowed_mime_types: string[] | null;
          avif_autodetection: boolean | null;
          created_at: string | null;
          file_size_limit: number | null;
          id: string;
          name: string;
          owner: string | null;
          owner_id: string | null;
          public: boolean | null;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string | null;
        };
        Insert: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id: string;
          name: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Update: {
          allowed_mime_types?: string[] | null;
          avif_autodetection?: boolean | null;
          created_at?: string | null;
          file_size_limit?: number | null;
          id?: string;
          name?: string;
          owner?: string | null;
          owner_id?: string | null;
          public?: boolean | null;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string | null;
        };
        Relationships: [];
      };
      buckets_analytics: {
        Row: {
          created_at: string;
          format: string;
          id: string;
          type: Database['storage']['Enums']['buckettype'];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          format?: string;
          id: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          format?: string;
          id?: string;
          type?: Database['storage']['Enums']['buckettype'];
          updated_at?: string;
        };
        Relationships: [];
      };
      iceberg_namespaces: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'iceberg_namespaces_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_analytics';
            referencedColumns: ['id'];
          },
        ];
      };
      iceberg_tables: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          location: string;
          name: string;
          namespace_id: string;
          updated_at: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id?: string;
          location: string;
          name: string;
          namespace_id: string;
          updated_at?: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          location?: string;
          name?: string;
          namespace_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'iceberg_tables_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets_analytics';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'iceberg_tables_namespace_id_fkey';
            columns: ['namespace_id'];
            isOneToOne: false;
            referencedRelation: 'iceberg_namespaces';
            referencedColumns: ['id'];
          },
        ];
      };
      migrations: {
        Row: {
          executed_at: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Insert: {
          executed_at?: string | null;
          hash: string;
          id: number;
          name: string;
        };
        Update: {
          executed_at?: string | null;
          hash?: string;
          id?: number;
          name?: string;
        };
        Relationships: [];
      };
      objects: {
        Row: {
          bucket_id: string | null;
          created_at: string | null;
          id: string;
          last_accessed_at: string | null;
          level: number | null;
          metadata: Json | null;
          name: string | null;
          owner: string | null;
          owner_id: string | null;
          path_tokens: string[] | null;
          updated_at: string | null;
          user_metadata: Json | null;
          version: string | null;
        };
        Insert: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          level?: number | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Update: {
          bucket_id?: string | null;
          created_at?: string | null;
          id?: string;
          last_accessed_at?: string | null;
          level?: number | null;
          metadata?: Json | null;
          name?: string | null;
          owner?: string | null;
          owner_id?: string | null;
          path_tokens?: string[] | null;
          updated_at?: string | null;
          user_metadata?: Json | null;
          version?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'objects_bucketId_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      prefixes: {
        Row: {
          bucket_id: string;
          created_at: string | null;
          level: number;
          name: string;
          updated_at: string | null;
        };
        Insert: {
          bucket_id: string;
          created_at?: string | null;
          level?: number;
          name: string;
          updated_at?: string | null;
        };
        Update: {
          bucket_id?: string;
          created_at?: string | null;
          level?: number;
          name?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'prefixes_bucketId_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads: {
        Row: {
          bucket_id: string;
          created_at: string;
          id: string;
          in_progress_size: number;
          key: string;
          owner_id: string | null;
          upload_signature: string;
          user_metadata: Json | null;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          id: string;
          in_progress_size?: number;
          key: string;
          owner_id?: string | null;
          upload_signature: string;
          user_metadata?: Json | null;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          id?: string;
          in_progress_size?: number;
          key?: string;
          owner_id?: string | null;
          upload_signature?: string;
          user_metadata?: Json | null;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
        ];
      };
      s3_multipart_uploads_parts: {
        Row: {
          bucket_id: string;
          created_at: string;
          etag: string;
          id: string;
          key: string;
          owner_id: string | null;
          part_number: number;
          size: number;
          upload_id: string;
          version: string;
        };
        Insert: {
          bucket_id: string;
          created_at?: string;
          etag: string;
          id?: string;
          key: string;
          owner_id?: string | null;
          part_number: number;
          size?: number;
          upload_id: string;
          version: string;
        };
        Update: {
          bucket_id?: string;
          created_at?: string;
          etag?: string;
          id?: string;
          key?: string;
          owner_id?: string | null;
          part_number?: number;
          size?: number;
          upload_id?: string;
          version?: string;
        };
        Relationships: [
          {
            foreignKeyName: 's3_multipart_uploads_parts_bucket_id_fkey';
            columns: ['bucket_id'];
            isOneToOne: false;
            referencedRelation: 'buckets';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 's3_multipart_uploads_parts_upload_id_fkey';
            columns: ['upload_id'];
            isOneToOne: false;
            referencedRelation: 's3_multipart_uploads';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      add_prefixes: {
        Args: { _bucket_id: string; _name: string };
        Returns: undefined;
      };
      can_insert_object: {
        Args: { bucketid: string; owner: string; metadata: Json; name: string };
        Returns: undefined;
      };
      delete_prefix: {
        Args: { _bucket_id: string; _name: string };
        Returns: boolean;
      };
      extension: {
        Args: { name: string };
        Returns: string;
      };
      filename: {
        Args: { name: string };
        Returns: string;
      };
      foldername: {
        Args: { name: string };
        Returns: string[];
      };
      get_level: {
        Args: { name: string };
        Returns: number;
      };
      get_prefix: {
        Args: { name: string };
        Returns: string;
      };
      get_prefixes: {
        Args: { name: string };
        Returns: string[];
      };
      get_size_by_bucket: {
        Args: Record<PropertyKey, never>;
        Returns: {
          size: number;
          bucket_id: string;
        }[];
      };
      list_multipart_uploads_with_delimiter: {
        Args: {
          bucket_id: string;
          delimiter_param: string;
          max_keys?: number;
          next_key_token?: string;
          next_upload_token?: string;
          prefix_param: string;
        };
        Returns: {
          key: string;
          id: string;
          created_at: string;
        }[];
      };
      list_objects_with_delimiter: {
        Args: {
          next_token?: string;
          max_keys?: number;
          start_after?: string;
          bucket_id: string;
          prefix_param: string;
          delimiter_param: string;
        };
        Returns: {
          updated_at: string;
          metadata: Json;
          id: string;
          name: string;
        }[];
      };
      operation: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      search: {
        Args: {
          limits?: number;
          prefix: string;
          bucketname: string;
          sortorder?: string;
          sortcolumn?: string;
          search?: string;
          offsets?: number;
          levels?: number;
        };
        Returns: {
          metadata: Json;
          last_accessed_at: string;
          created_at: string;
          updated_at: string;
          id: string;
          name: string;
        }[];
      };
      search_legacy_v1: {
        Args: {
          search?: string;
          sortcolumn?: string;
          sortorder?: string;
          prefix: string;
          bucketname: string;
          limits?: number;
          levels?: number;
          offsets?: number;
        };
        Returns: {
          metadata: Json;
          created_at: string;
          updated_at: string;
          id: string;
          name: string;
          last_accessed_at: string;
        }[];
      };
      search_v1_optimised: {
        Args: {
          sortcolumn?: string;
          sortorder?: string;
          prefix: string;
          bucketname: string;
          limits?: number;
          levels?: number;
          offsets?: number;
          search?: string;
        };
        Returns: {
          name: string;
          id: string;
          updated_at: string;
          created_at: string;
          last_accessed_at: string;
          metadata: Json;
        }[];
      };
      search_v2: {
        Args: {
          prefix: string;
          bucket_name: string;
          limits?: number;
          levels?: number;
          start_after?: string;
        };
        Returns: {
          metadata: Json;
          key: string;
          name: string;
          id: string;
          updated_at: string;
          created_at: string;
        }[];
      };
    };
    Enums: {
      buckettype: 'STANDARD' | 'ANALYTICS';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      announcement_status: ['pending', 'published', 'archived'],
      event_status: ['pending', 'approved', 'duplicate', 'archived'],
      import_frequency: ['hourly', 'daily', 'weekly', 'manual'],
    },
  },
  storage: {
    Enums: {
      buckettype: ['STANDARD', 'ANALYTICS'],
    },
  },
} as const;
