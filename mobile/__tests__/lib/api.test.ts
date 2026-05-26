import { fetchEvents, fetchEventById } from '../../lib/api';

const MOCK_EVENT = {
  id: '1',
  title: 'Test Event',
  start_date: '2026-05-26',
  end_date: null,
  start_time: '10:00:00',
  end_time: null,
  description: null,
  website: null,
  registration: null,
  cost: null,
  featured: null,
  external_image_url: null,
  parent_event_id: null,
  location_id: null,
  organization_id: null,
  primary_tag: { name: 'nature' },
  secondary_tag: null,
  location: null,
  organization: null,
};

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  jest.resetAllMocks();
});

describe('fetchEvents', () => {
  it('calls /api/events/search with no params when called with empty object', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [MOCK_EVENT] }),
    });

    const result = await fetchEvents({});
    expect(global.fetch).toHaveBeenCalledTimes(1);
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('/api/events/search');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('appends q param when query provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    });

    await fetchEvents({ q: 'hiking' });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('q=hiking');
  });

  it('appends category param when provided', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ events: [] }),
    });

    await fetchEvents({ category: 'nature' });
    const url = (global.fetch as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain('category=nature');
  });

  it('returns empty array when events key is missing from response', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await fetchEvents({});
    expect(result).toEqual([]);
  });

  it('throws when response is not ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(fetchEvents({})).rejects.toThrow('Failed to fetch events: 500');
  });
});

describe('fetchEventById', () => {
  it('returns the event for a valid id', async () => {
    const mockEvent = {
      id: 'abc-123',
      title: 'Detail Event',
      start_date: '2026-06-01',
      end_date: null,
      start_time: '10:00:00',
      end_time: null,
      description: 'A full description',
      website: 'https://example.com',
      registration: false,
      cost: null,
      featured: null,
      external_image_url: null,
      parent_event_id: null,
      location_id: 'loc-1',
      organization_id: 'org-1',
      primary_tag: { name: 'arts-culture' },
      secondary_tag: null,
      location: { id: 'loc-1', name: 'Icicle Creek Center', address: '7238 Icicle Rd', latitude: 47.591, longitude: -120.68 },
      organization: { name: 'Arts Alliance' },
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ event: mockEvent }),
    });

    const result = await fetchEventById('abc-123');

    expect(result).toEqual(mockEvent);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:4321/api/events/abc-123'
    );
  });

  it('throws on HTTP error', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    await expect(fetchEventById('bad-id')).rejects.toThrow('Failed to fetch event: 404');
  });
});
