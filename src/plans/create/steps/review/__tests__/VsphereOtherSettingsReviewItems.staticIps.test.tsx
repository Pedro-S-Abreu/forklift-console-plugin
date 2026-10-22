import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { PROVIDER_TYPES } from '@utils/providers/constants';

import { StaticIpSelectionMode } from '../../other-settings/constants';
import VsphereOtherSettingsReviewItems from '../VsphereOtherSettingsReviewItems';

jest.mock('@utils/i18n', () => {
  const t = (key: string, params?: Record<string, unknown>): string =>
    key.replace(
      /\{\{(?<name>\w+)\}\}/gu,
      (match, name: string) => params?.[name]?.toString() ?? match,
    );
  return { t, useForkliftTranslation: (): { t: typeof t } => ({ t }) };
});

describe('VsphereOtherSettingsReviewItems static IP summary', () => {
  it('reports the number of selected vNICs in manual mode', () => {
    const vm = {
      id: 'vm-1',
      name: 'first',
      providerType: PROVIDER_TYPES.vsphere,
      nics: [{ mac: 'aa:bb:cc:dd:ee:01' }, { mac: 'aa:bb:cc:dd:ee:02' }],
    } as never;

    render(
      <VsphereOtherSettingsReviewItems
        excludedNicsFromStaticIPs={{ 'vm-1': ['aa:bb:cc:dd:ee:02'] }}
        preserveStaticIps
        staticIpSelectionMode={StaticIpSelectionMode.Manual}
        vms={{ 'vm-1': vm }}
      />,
    );

    expect(screen.getByTestId('review-preserve-static-ips')).toHaveTextContent(
      '1 of 2 vNICs selected',
    );
  });
});
