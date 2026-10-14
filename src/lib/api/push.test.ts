import { describe, expect, it, vi } from 'vitest';
import { ApiError, type MastodonClient } from './client';
import { createPushSubscription, deletePushSubscription, getPushSubscription, getVapidKey, updatePushSubscription } from './push';
import { allAlerts } from '../pushLogic';

const fake = (over: Partial<Record<'get' | 'post' | 'put' | 'delete', ReturnType<typeof vi.fn>>>) =>
  ({ get: vi.fn(), post: vi.fn().mockResolvedValue({}), put: vi.fn().mockResolvedValue({}), delete: vi.fn().mockResolvedValue({}), ...over }) as unknown as MastodonClient &
    Record<'get' | 'post' | 'put' | 'delete', ReturnType<typeof vi.fn>>;

describe('getVapidKey', () => {
  it("reads the server's key from the instance information", async () => {
    const c = fake({ get: vi.fn().mockResolvedValue({ configuration: { vapid: { public_key: 'KEY' } } }) });
    expect(await getVapidKey(c)).toBe('KEY');
    expect(c.get).toHaveBeenCalledWith('/api/v2/instance');
  });

  it('is null for a server that does not tell it', async () => {
    expect(await getVapidKey(fake({ get: vi.fn().mockResolvedValue({ configuration: {} }) }))).toBeNull();
    expect(await getVapidKey(fake({ get: vi.fn().mockResolvedValue({}) }))).toBeNull();
  });
});

describe('getPushSubscription', () => {
  it('is null when this login has none (404), and throws on other errors', async () => {
    expect(await getPushSubscription(fake({ get: vi.fn().mockRejectedValue(new ApiError(404, 'Record not found')) }))).toBeNull();
    await expect(getPushSubscription(fake({ get: vi.fn().mockRejectedValue(new ApiError(401, 'no')) }))).rejects.toThrow('no');
  });
});

describe('subscribing', () => {
  it('sends the endpoint, the keys, the alerts and the standard encryption', async () => {
    const c = fake({});
    await createPushSubscription(c, { endpoint: 'https://push.example/x', p256dh: 'P', auth: 'A' }, allAlerts(), 'followed');
    const [path, body] = c.post.mock.calls[0];
    expect(path).toBe('/api/v1/push/subscription');
    expect(body.subscription).toEqual({ endpoint: 'https://push.example/x', keys: { p256dh: 'P', auth: 'A' }, standard: true });
    expect(body.data.policy).toBe('followed');
    expect(body.data.alerts.mention).toBe(true);
  });

  it('changes the alerts in place', async () => {
    const c = fake({});
    await updatePushSubscription(c, { ...allAlerts(), favourite: false }, 'all');
    expect(c.put).toHaveBeenCalledWith('/api/v1/push/subscription', { data: { alerts: { ...allAlerts(), favourite: false }, policy: 'all' } });
  });

  it('removes the subscription', async () => {
    const c = fake({});
    await deletePushSubscription(c);
    expect(c.delete).toHaveBeenCalledWith('/api/v1/push/subscription');
  });
});
