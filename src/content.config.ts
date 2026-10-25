import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';

const activityFields = {
  title: z.string(),
  text: z.string(),
  subtext: z.string().optional(),
  icon: z.string(),
};

/** A card is either one clickable `link` or several inline `links` (e.g. outfitters). */
const seasonalActivity = z.union([
  z.object({ ...activityFields, link: z.url() }).strict(),
  z
    .object({
      ...activityFields,
      links: z.array(z.object({ label: z.string(), url: z.url() })).min(1),
    })
    .strict(),
]);

/** One entry per season (winter, spring, summer, fall), keyed by season name. */
const seasonalActivities = defineCollection({
  loader: file('src/data/seasonal-activities.yaml'),
  schema: z.object({ activities: z.array(seasonalActivity) }),
});

export const collections = { seasonalActivities };
