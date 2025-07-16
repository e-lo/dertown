import { z } from 'zod';

// Simple form validation schemas for user input
// These match the database constraints but are kept simple for forms

export const eventFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  // Hybrid fields: either ID (UUID) or name (string)
  location_id: z.string().uuid().optional().or(z.literal('')),
  location_added: z
    .string()
    .max(255, 'Location name must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  organization_id: z.string().uuid().optional().or(z.literal('')),
  organization_added: z
    .string()
    .max(255, 'Organization name must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  registration_link: z.string().url('Invalid URL format').optional().or(z.literal('')),
  primary_tag_id: z.string().uuid().optional().or(z.literal('')),
  secondary_tag_id: z.string().uuid().optional().or(z.literal('')),
  external_image_url: z.string().url('Invalid URL format').optional().or(z.literal('')),
  featured: z.boolean().optional(),
  exclude_from_calendar: z.boolean().optional(),
  registration: z.boolean().optional(),
  cost: z.string().max(100, 'Cost must be less than 100 characters').optional(),
  comments: z
    .string()
    .max(2000, 'Comments must be less than 2000 characters')
    .optional()
    .or(z.literal('')),
  // Honeypot field - should always be empty
  website_url: z.string().max(0, 'Invalid submission detected').optional().or(z.literal('')),
  // Timestamp for rate limiting
  submission_time: z.string().optional(),
});

export const locationFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  address: z.string().max(500, 'Address must be less than 500 characters').optional(),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  phone: z.string().max(20, 'Phone must be less than 20 characters').optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  parent_location_id: z.string().uuid().optional(),
});

export const organizationFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255, 'Name must be less than 255 characters'),
  description: z.string().max(2000, 'Description must be less than 2000 characters').optional(),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  phone: z.string().max(20, 'Phone must be less than 20 characters').optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  location_id: z.string().uuid().optional(),
  parent_organization_id: z.string().uuid().optional(),
});

export const announcementFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255, 'Title must be less than 255 characters'),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(2000, 'Message must be less than 2000 characters'),
  show_at: z.string().optional(),
  expires_at: z.string().optional(),
  link: z.string().url('Invalid URL format').optional().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  organization_id: z.string().uuid().optional().or(z.literal('')),
  organization_name: z
    .string()
    .max(255, 'Organization name must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  organization_added: z
    .string()
    .max(255, 'Organization name must be less than 255 characters')
    .optional()
    .or(z.literal('')),
  comments: z
    .string()
    .max(2000, 'Comments must be less than 2000 characters')
    .optional()
    .or(z.literal('')),
  // Honeypot field - should always be empty
  website_url: z.string().max(0, 'Invalid submission detected').optional().or(z.literal('')),
  // Timestamp for rate limiting
  submission_time: z.string().optional(),
});

// Type exports for TypeScript
export type EventFormData = z.infer<typeof eventFormSchema>;
export type LocationFormData = z.infer<typeof locationFormSchema>;
export type OrganizationFormData = z.infer<typeof organizationFormSchema>;
export type AnnouncementFormData = z.infer<typeof announcementFormSchema>;

// Validation helper functions
export const validateEventForm = (data: unknown) => {
  return eventFormSchema.safeParse(data);
};

export const validateLocationForm = (data: unknown) => {
  return locationFormSchema.safeParse(data);
};

export const validateOrganizationForm = (data: unknown) => {
  return organizationFormSchema.safeParse(data);
};

export const validateAnnouncementForm = (data: unknown) => {
  return announcementFormSchema.safeParse(data);
};
