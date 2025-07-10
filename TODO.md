# 📋 Der Town Implementation Plan

## 🚦 Next Steps (Prioritized)

2. **Homepage Per-Category Carousels**
   - Implement a carousel for each event category on the homepage (currently only a single main carousel is present).

3. **Category-Specific RSS & Calendar Feeds**
   - Add endpoints and UI links for category-specific RSS and iCal feeds (currently only global feeds exist).

4. **Social Sharing Functionality**
   - Expand social sharing beyond the event detail page (where Web Share API and copy-to-clipboard are implemented) to event lists and carousels.

5. **Fuzzy Matching for Organizations/Locations in Submission Form**
   - Implement fuzzy search/autocomplete for organizations and locations in the event submission form.

6. **Honeypot/CAPTCHA Protection**
   - Add spam protection to the public event submission form.

7. **Admin Interface Polish**
   - Review Supabase dashboard setup for admin workflows; only build custom Astro admin UI if needed.

8. **Category-Specific Calendar Views**
   - Add filterable calendar views and permalinks for each category, organization, and location.

9. **Technical Debt & Polish**
   - Add error handling, loading states, SEO meta tags, structured data, and a comprehensive test suite.

---

## ✅ Completed or No Longer Necessary

- **Fix API Routes & Server Configuration**: Astro is now configured for SSR. All API routes and dynamic pages are server-rendered and up-to-date with the database. For local dev, use SSR without the Netlify adapter; for production, use the Netlify adapter and deploy to Netlify.
- **Shoelace Carousel**: Replaced with Glider.js for static-first, minimal-JS carousel.
- **Event Carousel Card**: Now uses plain HTML and Tailwind CSS, no Shoelace dependency.
- **Main Event Carousel**: Fully implemented and visually polished.
- **Event Submission Page**: Created `/submit` page with EventForm component.
- **Basic Makefile, Python utilities, and database scripts**: Implemented and documented.
- **Public Submission Form**: Implemented, but needs fuzzy matching and spam protection.
- **Announcement Marquee**: Implemented and styled.
- **Responsive Layout**: Implemented for all major pages/components.
- **Event List and Filtering**: Implemented on `/events` page.
- **Event Detail Pages**: Implemented with calendar export and sharing.
- **Calendar UI**: FullCalendar.js integrated and filterable.
- **Social Sharing (Event Detail Page)**: Implemented with Web Share API and clipboard fallback.

---

## 🟡 In Progress / Needs Attention

- **API routes and dynamic pages are now SSR and work in production. For local dev, use SSR without the Netlify adapter.**
- **RSS/iCal/Google Calendar Feeds**: API endpoints exist but don't work due to server configuration issues. Static redirect pages created but need server-side API routes to function.
- **Homepage Per-Category Carousels**: Not yet implemented. Only a single main carousel is present. Need to add a loop over categories and render a carousel for each, with appropriate filtering.
- **Category-Specific RSS & iCal Feeds**: Only global feeds are implemented. Need to add endpoints and UI for category-specific feeds.
- **Social Sharing (List/Carousel)**: Only present on event detail page. Should be added to event cards and carousels for easier sharing.
- **Fuzzy Matching in Submission Form**: Not yet implemented. Needs autocomplete/fuzzy search for organizations and locations.
- **Honeypot/CAPTCHA**: Not yet implemented on the submission form.
- **Admin Interface Polish**: Supabase dashboard is primary; custom UI is optional and not started.
- **Category-Specific Calendar Views**: Filtering and permalinks for category/org/location views are not yet implemented.
- **Technical Debt**: Error handling, loading states, SEO, structured data, and tests are still needed.

---

## ❌ Items No Longer Needed or Changed Approach

- **Shoelace Web Components**: No longer used for carousels or cards.
- **Complex Admin UI**: Only build if Supabase dashboard is insufficient.
- **Advanced Duplicate Detection**: Not needed for MVP; keep exact match only for now.
- **Comprehensive Testing Framework**: Manual testing is sufficient for MVP; add tests post-launch.

---

## 📝 Notes

- **Critical Issue**: API routes are not working due to missing server-side configuration. This blocks RSS feeds, calendar exports, and form submissions.
- The project is well-aligned with the static-first, minimal-JS, and rapid iteration philosophy in `PROJECT_REQUIREMENTS.md`.
- Focus should remain on pragmatic, user-facing features and polish, not over-engineering.
- The homepage and event detail experience are now visually and functionally strong; next steps should focus on fixing the server configuration, then category-specific features, sharing, and submission polish.
