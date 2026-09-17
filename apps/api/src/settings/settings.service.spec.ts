import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { SettingsService } from './settings.service';

describe('SettingsService', () => {
  const db = { organizationSettings: { upsert: jest.fn() } };
  const audit = { record: jest.fn() };
  const service = new SettingsService(db as never, audit as never);
  beforeEach(() => jest.clearAllMocks());

  it('allows employees to read the organization typography settings', async () => {
    db.organizationSettings.upsert.mockResolvedValue({ organizationId: 'org-1', fontKey: 'cairo', typographyScale: 'standard', screenshotIntervalSeconds: 300 });
    const result = await service.get({ id: 'employee', role: 'EMPLOYEE', organizationId: 'org-1' });
    expect(result.fontKey).toBe('cairo');
    expect(result.typographyScale).toBe('standard');
    expect(result.screenshotIntervalSeconds).toBe(300);
    expect(result.supportedFonts).toContain('readex-pro');
    expect(result.supportedTypographyScales).toEqual(['compact', 'standard', 'comfortable', 'large']);
  });

  it('allows administrators to update and audit global typography', async () => {
    db.organizationSettings.upsert.mockResolvedValue({ organizationId: 'org-1', fontKey: 'almarai', typographyScale: 'comfortable', screenshotIntervalSeconds: 120 });
    await service.update({ fontKey: 'almarai', typographyScale: 'comfortable', screenshotIntervalSeconds: 120 }, { id: 'admin', role: 'ADMIN', organizationId: 'org-1' });
    expect(db.organizationSettings.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { fontKey: 'almarai', typographyScale: 'comfortable', screenshotIntervalSeconds: 120 } }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({
      action: 'ORGANIZATION_SETTINGS_UPDATED',
      metadata: { fontKey: 'almarai', typographyScale: 'comfortable', screenshotIntervalSeconds: 120 },
    }));
  });

  it('rejects global changes from non-administrators', async () => {
    await expect(service.update({ fontKey: 'cairo' }, { id: 'manager', role: 'MANAGER', organizationId: 'org-1' })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects empty organization updates', async () => {
    await expect(service.update({}, { id: 'admin', role: 'ADMIN', organizationId: 'org-1' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
