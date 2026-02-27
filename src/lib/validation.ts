import { z } from 'zod';
import {
  MAX_TITLE,
  MAX_DESCRIPTION,
  MAX_NAME,
  MAX_ADDRESS,
  MAX_PHONE,
  MAX_COST,
  MAX_COMMENTS,
  MAX_ALT_TEXT,
} from './constants';

// Simple form validation schemas for user input
// These match the database constraints but are kept simple for forms

export const eventFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(MAX_TITLE, `Title must be less than ${MAX_TITLE} characters`),
  description: z.string().max(MAX_DESCRIPTION, `Description must be less than ${MAX_DESCRIPTION} characters`).optional(),
  start_date: z.string().min(1, 'Start date is required'),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  // Hybrid fields: either ID (UUID) or name (string)
  location_id: z.string().uuid().optional().or(z.literal('')),
  location_added: z
    .string()
    .max(MAX_NAME, `Location name must be less than ${MAX_NAME} characters`)
    .optional()
    .or(z.literal('')),
  organization_id: z.string().uuid().optional().or(z.literal('')),
  organization_added: z
    .string()
    .max(MAX_NAME, `Organization name must be less than ${MAX_NAME} characters`)
    .optional()
    .or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  registration_link: z.string().url('Invalid URL format').optional().or(z.literal('')),
  primary_tag_id: z.string().uuid().optional().or(z.literal('')),
  secondary_tag_id: z.string().uuid().optional().or(z.literal('')),
  external_image_url: z.string().url('Invalid URL format').optional().or(z.literal('')),
  image_alt_text: z
    .string()
    .max(MAX_ALT_TEXT, `Alt text must be less than ${MAX_ALT_TEXT} characters`)
    .optional()
    .or(z.literal('')),
  featured: z.boolean().optional(),
  exclude_from_calendar: z.boolean().optional(),
  registration: z.boolean().optional(),
  cost: z.string().max(MAX_COST, `Cost must be less than ${MAX_COST} characters`).optional(),
  comments: z
    .string()
    .max(MAX_COMMENTS, `Comments must be less than ${MAX_COMMENTS} characters`)
    .optional()
    .or(z.literal('')),
  // Honeypot field - should always be empty
  website_url: z.string().max(0, 'Invalid submission detected').optional().or(z.literal('')),
  // Timestamp for rate limiting
  submission_time: z.string().optional(),
});

export const locationFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(MAX_NAME, `Name must be less than ${MAX_NAME} characters`),
  address: z.string().max(MAX_ADDRESS, `Address must be less than ${MAX_ADDRESS} characters`).optional(),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  phone: z.string().max(MAX_PHONE, `Phone must be less than ${MAX_PHONE} characters`).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  parent_location_id: z.string().uuid().optional(),
});

export const organizationFormSchema = z.object({
  name: z.string().min(1, 'Name is required').max(MAX_NAME, `Name must be less than ${MAX_NAME} characters`),
  description: z.string().max(MAX_DESCRIPTION, `Description must be less than ${MAX_DESCRIPTION} characters`).optional(),
  website: z.string().url('Invalid URL format').optional().or(z.literal('')),
  phone: z.string().max(MAX_PHONE, `Phone must be less than ${MAX_PHONE} characters`).optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  location_id: z.string().uuid().optional(),
  parent_organization_id: z.string().uuid().optional(),
});

export const announcementFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(MAX_TITLE, `Title must be less than ${MAX_TITLE} characters`),
  message: z
    .string()
    .min(1, 'Message is required')
    .max(MAX_DESCRIPTION, `Message must be less than ${MAX_DESCRIPTION} characters`),
  show_at: z.string().optional(),
  expires_at: z.string().optional(),
  link: z.string().url('Invalid URL format').optional().or(z.literal('')),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  organization_id: z.string().uuid().optional().or(z.literal('')),
  organization_name: z
    .string()
    .max(MAX_NAME, `Organization name must be less than ${MAX_NAME} characters`)
    .optional()
    .or(z.literal('')),
  organization_added: z
    .string()
    .max(MAX_NAME, `Organization name must be less than ${MAX_NAME} characters`)
    .optional()
    .or(z.literal('')),
  comments: z
    .string()
    .max(MAX_COMMENTS, `Comments must be less than ${MAX_COMMENTS} characters`)
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
