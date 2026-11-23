import { expect, test } from 'bun:test';
import { makeProgressNotification } from './progress-notification';
import { buildStudentProgress } from './student-progress';

const progress = (score: number) => buildStudentProgress([
  { subject_id: 'math', subject: 'Math', total: score, term: 'Series 1', class_name: 'Primary 3', academic_year: '2025-2026' },
], [{ class_name: 'Primary 3', term: 'Series 1', academic_year: '2025-2026', approved_by_admin: true }], '2025-2026');
test('alerts target only the recorded student and their own parent', () => {
  const notification = makeProgressNotification({ id: 'child-one', full_name: 'Child', parent_id: 'parent-one' }, progress(20));
  expect(notification?.target).toEqual({ role: 'parent', userIdentifiers: ['child-one', 'parent-one'] });
});
test('parent-less logins receive only their own child alert', () => {
  expect(makeProgressNotification({ id: 'child-two', full_name: 'Child' }, progress(20))?.target.userIdentifiers).toEqual(['child-two']);
});
test('no notification is generated for passing stable results', () => {
  expect(makeProgressNotification({ id: 'child', full_name: 'Child' }, progress(80))).toBeNull();
});