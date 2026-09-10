import { Alert, Linking } from 'react-native';
import { openMailto, openTel } from '../../lib/linkingUtils';

describe('linkingUtils', () => {
  let openURL: jest.SpyInstance;
  let alert: jest.SpyInstance;

  beforeEach(() => {
    openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('openMailto', () => {
    it('opens a mailto URL with the subject percent-encoded', async () => {
      await openMailto('hello@example.com', 'Event update: Ukulele Circle (PLUC)');
      expect(openURL).toHaveBeenCalledWith(
        'mailto:hello@example.com?subject=Event%20update%3A%20Ukulele%20Circle%20(PLUC)'
      );
      expect(alert).not.toHaveBeenCalled();
    });

    it('omits the subject query when no subject is given', async () => {
      await openMailto('hello@example.com');
      expect(openURL).toHaveBeenCalledWith('mailto:hello@example.com');
    });

    it('shows the address in an alert instead of rejecting when no mail app can open it', async () => {
      openURL.mockRejectedValue(new Error('Unable to open URL: mailto:hello@example.com'));
      await expect(openMailto('hello@example.com', 'Subject')).resolves.toBeUndefined();
      expect(alert).toHaveBeenCalledTimes(1);
      const [title, message] = alert.mock.calls[0];
      expect(title).toBe('No mail app available');
      expect(message).toContain('hello@example.com');
    });
  });

  describe('openTel', () => {
    it('strips formatting from the number before dialing', async () => {
      await openTel('(509) 555-1234');
      expect(openURL).toHaveBeenCalledWith('tel:5095551234');
    });

    it('shows the number in an alert instead of rejecting when no phone app can open it', async () => {
      openURL.mockRejectedValue(new Error('Unable to open URL: tel:5095551234'));
      await expect(openTel('(509) 555-1234')).resolves.toBeUndefined();
      expect(alert).toHaveBeenCalledTimes(1);
      const [title, message] = alert.mock.calls[0];
      expect(title).toBe('No phone app available');
      expect(message).toContain('(509) 555-1234');
    });
  });
});
