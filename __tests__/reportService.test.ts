import { describe, it, expect, vi } from 'vitest';
import { getReport } from '@/modules/report/reportService';
import { reportSchema } from '@/shared/schemas/report';

const makeLogger = () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() });

describe('getReport', () => {
  it('returns a schema-valid Report', async () => {
    const r = await getReport(makeLogger());
    expect(() => reportSchema.parse(r)).not.toThrow();
  });
  it('has findings.length > 0', async () => { expect((await getReport(makeLogger())).findings.length).toBeGreaterThan(0); });
  it('has daySummaries.length === coverageDays', async () => { const r = await getReport(makeLogger()); expect(r.daySummaries.length).toBe(r.coverageDays); });
  it('has alternativeExplanation on every finding', async () => { (await getReport(makeLogger())).findings.forEach(f => expect(f.alternativeExplanation).toBeTruthy()); });
  it('calls logger.info exactly once', async () => { const l = makeLogger(); await getReport(l); expect(l.info).toHaveBeenCalledTimes(1); });
});
