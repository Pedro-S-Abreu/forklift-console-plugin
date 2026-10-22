import type { FC } from 'react';
import {
  getEffectiveStaticIpExclusions,
  getStaticIpNicRows,
  type StaticIpExclusions,
} from 'src/plans/utils/staticIpPreservation/staticIpNicRows';

import {
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
} from '@patternfly/react-core';
import { useForkliftTranslation } from '@utils/i18n';

import type { ProviderVirtualMachine } from '../../types';
import {
  otherFormFieldLabels,
  OtherSettingsFormFieldId,
  StaticIpSelectionMode,
} from '../other-settings/constants';

type VsphereOtherSettingsReviewItemsProps = {
  excludedNicsFromStaticIPs?: StaticIpExclusions;
  nbdeClevis?: boolean;
  preserveStaticIps?: boolean;
  rootDevice?: string;
  sharedDisks?: boolean;
  staticIpSelectionMode?: StaticIpSelectionMode;
  vms?: Record<string, ProviderVirtualMachine>;
};

const VsphereOtherSettingsReviewItems: FC<VsphereOtherSettingsReviewItemsProps> = ({
  excludedNicsFromStaticIPs,
  nbdeClevis,
  preserveStaticIps,
  rootDevice,
  sharedDisks,
  staticIpSelectionMode,
  vms,
}) => {
  const { t } = useForkliftTranslation();
  const nicRows = getStaticIpNicRows(Object.values(vms ?? {}));
  const effectiveExclusions = getEffectiveStaticIpExclusions(
    nicRows,
    excludedNicsFromStaticIPs ?? {},
  );
  const excludedCount = Object.values(effectiveExclusions).reduce(
    (count, macs) => count + macs.length,
    0,
  );
  const selectedCount = nicRows.length - excludedCount;
  let preservationSummary = t('Disabled');
  if (preserveStaticIps) {
    preservationSummary = t('All vNICs');
    if (staticIpSelectionMode === StaticIpSelectionMode.Manual) {
      preservationSummary = t('{{selectedCount}} of {{totalCount}} vNICs selected', {
        selectedCount,
        totalCount: nicRows.length,
      });
    }
  }

  return (
    <>
      <DescriptionListGroup>
        <DescriptionListTerm>{t('Use NBDE/Clevis')}</DescriptionListTerm>
        <DescriptionListDescription data-testid="review-nbde-clevis">
          {nbdeClevis ? t('Enabled') : t('Disabled')}
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>
          {otherFormFieldLabels[OtherSettingsFormFieldId.PreserveStaticIps]}
        </DescriptionListTerm>
        <DescriptionListDescription data-testid="review-preserve-static-ips">
          {preservationSummary}
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>
          {otherFormFieldLabels[OtherSettingsFormFieldId.RootDevice]}
        </DescriptionListTerm>
        <DescriptionListDescription data-testid="review-root-device">
          {rootDevice ?? t('First root device')}
        </DescriptionListDescription>
      </DescriptionListGroup>

      <DescriptionListGroup>
        <DescriptionListTerm>
          {otherFormFieldLabels[OtherSettingsFormFieldId.MigrateSharedDisks]}
        </DescriptionListTerm>
        <DescriptionListDescription data-testid="review-shared-disks">
          {sharedDisks ? t('Enabled') : t('Disabled')}
        </DescriptionListDescription>
      </DescriptionListGroup>
    </>
  );
};

export default VsphereOtherSettingsReviewItems;
