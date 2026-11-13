import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

const require = createRequire(import.meta.url);
const content = require('../lib/public-content');

test('calendar dates preserve ISO and existing Indonesian dates without timezone shifts', () => {
  assert.equal(content.parseDate('07 Juni 2025').iso, '2025-06-07');
  assert.equal(content.formatDate('2031-07-03'), '3 Juli 2031');
  assert.equal(content.parseDate('29 Februari 2028').iso, '2028-02-29');
  for (const date of ['2026-02-29', '2026-02-31', '2026-13-01', '31 April 2026', 'not a date', null]) assert.equal(content.parseDate(date), null);
  assert.equal(content.today(new Date('2026-11-12T18:00:00Z')), '2026-11-13');
  assert.equal(content.shiftMonth('2026-12', 1), '2027-01');
  assert.equal(content.shiftMonth('2026-01', -1), '2025-12');
  const month = content.calendar('2028-02', [{ id: 'iso', date: '2028-02-29' }, { id: 'old', date: '29 Februari 2028' }, { id: 'other', date: '2028-03-01' }]);
  assert.equal(month.label, 'Februari 2028');
  assert.equal(month.days.filter((day) => day.day).length, 29);
  assert.equal(month.days.find((day) => day.day === 29).events.length, 2);
  assert.ok(month.days.filter((day) => day.day !== 29).every((day) => day.events.length === 0));
});

test('public image/link fields reject executable URLs and invalid dates', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>alert(1)</script>', '//other.example/image.png', 'file:///secret']) assert.equal(content.safeUrl(url, true), '');
  assert.equal(content.safeUrl('/assets/SDN.jpg', true), '/assets/SDN.jpg');
  assert.equal(content.safeUrl('https://example.test/image.png', true), 'https://example.test/image.png');
  assert.equal(content.safeUrl('data:image/png;base64,aGVsbG8=', true), 'data:image/png;base64,aGVsbG8=');
  assert.throws(() => content.validatePublicRecord('agenda', { date: '2026-02-31' }), /Tanggal/);
  assert.throws(() => content.validatePublicRecord('posts', { imageUrl: 'javascript:alert(1)' }), /gambar/);
  assert.throws(() => content.validateSiteMeta({ contactEmail: 'wrong' }), /email/);
  assert.deepEqual(content.missionItems('Satu\n\nDua'), ['Satu', 'Dua']);
  assert.deepEqual(content.missionItems(['Satu', 'Dua']), ['Satu', 'Dua']);
});
