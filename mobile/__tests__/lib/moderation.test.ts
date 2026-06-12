import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loadTermsAgreed,
  saveTermsAgreed,
  loadBlockedOrgs,
  saveBlockedOrgs,
  submitReport,
} from '../../lib/moderation';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.restoreAllMocks();
});

describe('terms agreement', () => {
  it('defaults to not agreed', async () => {
    expect(await loadTermsAgreed()).toBe(false);
  });

  it('persists agreement', async () => {
    await saveTermsAgreed();
    expect(await loadTermsAgreed()).toBe(true);
  });
});

describe('blocked organizers', () => {
  it('defaults to empty list', async () => {
    expect(await loadBlockedOrgs()).toEqual([]);
  });

  it('round-trips blocked orgs', async () => {
    const orgs = [{ id: 'org-1', name: 'Test Org' }];
    await saveBlockedOrgs(orgs);
    expect(await loadBlockedOrgs()).toEqual(orgs);
  });

  it('returns empty list on corrupted data', async () => {
    await AsyncStorage.setItem('dertown:blocked_orgs', 'not-json{');
    expect(await loadBlockedOrgs()).toEqual([]);
  });
});

describe('submitReport', () => {
  it('POSTs the report to /api/mobile/report and resolves true on ok', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);

    const ok = await submitReport({
      action: 'report',
      contentType: 'event',
      contentId: 'evt-1',
      contentTitle: 'Some Event',
      reason: 'Spam or misleading',
    });

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/mobile/report'),
      expect.objectContaining({ method: 'POST' })
    );
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      action: 'report',
      contentType: 'event',
      contentId: 'evt-1',
      reason: 'Spam or misleading',
    });
  });

  it('resolves false instead of throwing on network failure', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));

    const ok = await submitReport({
      action: 'block',
      contentType: 'organization',
      contentId: 'org-1',
      contentTitle: 'Bad Org',
      reason: 'User blocked this organizer',
    });

    expect(ok).toBe(false);
  });
});
