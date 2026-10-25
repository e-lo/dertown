/**
 * Globals that inline `<script>` blocks in .astro pages assign onto `window`
 * so that `onclick="..."` attributes and sibling script blocks can call them.
 *
 * Astro type-checks each inline script as its own module, so without these
 * declarations every `window.foo = ...` / `foo()` across script blocks is an
 * error. Keep the signatures loose: the handlers are wired from HTML strings,
 * not called from typed code. Add a name here when you expose a new one.
 */
export {};

type GlobalHandler = (...args: any[]) => any;

declare global {
  interface Window {
    // auth / layout
    openLoginModal: GlobalHandler;
    shareEvent: GlobalHandler;

    // admin: organizations & locations
    openAddOrganizationModal: GlobalHandler;
    closeAddOrganizationModal: GlobalHandler;
    editOrganization: GlobalHandler;
    deleteOrganization: GlobalHandler;
    openAddLocationModal: GlobalHandler;
    editLocation: GlobalHandler;
    deleteLocation: GlobalHandler;
    openOrgUserModal: GlobalHandler;

    // admin: series & occurrences
    editSeries: GlobalHandler;
    closeEditSeriesModal: GlobalHandler;
    selectEditSeriesOrganization: GlobalHandler;
    selectEditSeriesLocation: GlobalHandler;
    toggleAllEvents: GlobalHandler;
    addOccurrences: GlobalHandler;
    closeAddOccurrencesModal: GlobalHandler;
    updateAddOccPreview: GlobalHandler;
    updateAddOccPatternOptions: GlobalHandler;
    updateAddOccCustomDatesFromManual: GlobalHandler;
    changeAddOccCalendarMonth: GlobalHandler;
    removeAddOccDate: GlobalHandler;

    // admin: announcements
    openCreateAnnouncementModal: GlobalHandler;
    closeEditAnnouncementModal: GlobalHandler;
    editAnnouncement: GlobalHandler;
    approveAnnouncement: GlobalHandler;
    archiveAnnouncement: GlobalHandler;
  }

  // Called by bare name from a different <script> block than the one that
  // defines them (they are also assigned onto window there).
  function updateAddOccPreview(...args: any[]): void;
  function closeAddOccurrencesModal(...args: any[]): void;
  function closeEditSeriesModal(...args: any[]): void;
}
