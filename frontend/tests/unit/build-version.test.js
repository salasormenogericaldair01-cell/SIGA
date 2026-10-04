import { expect, it } from 'vitest';
import { getBuildVersion } from '../../src/utils/buildVersion';

it('publica solo ocho caracteres hexadecimales o unknown', () => {
  expect(getBuildVersion('ABCDEF1234567890')).toBe('abcdef12');
  expect(getBuildVersion(undefined, '1234567abcdef')).toBe('1234567a');
  expect(getBuildVersion('host=private;token=secret')).toBe('unknown');
  expect(getBuildVersion()).toBe('unknown');
});
