import type { FC } from 'react';
import { DetailsItem } from 'src/components/DetailItems/DetailItem';
import { isPlanEditable } from 'src/plans/details/components/PlanStatus/utils/planStatusPermissions';
import type { EditPlanProps } from 'src/plans/details/tabs/Details/components/SettingsSection/utils/types';
import { useForkliftTranslation } from 'src/utils/i18n';

import { useOverlay } from '@openshift-console/dynamic-plugin-sdk';
import { Label } from '@patternfly/react-core';
import {
  getPlanPreserveIP,
  getPlanVirtualMachines,
  getVmExcludedNicsFromStaticIPs,
} from '@utils/crds/plans/selectors';

import type { EditableDetailsItemProps } from '../../../utils/types';

import EditPlanPreserveStaticIPs from './EditPlanPreserveStaticIPs';

const PreserveStaticIPsDetailsItem: FC<EditableDetailsItemProps> = ({
  canPatch,
  plan,
  shouldRender,
}) => {
  const { t } = useForkliftTranslation();
  const launchOverlay = useOverlay();

  if (!shouldRender) {
    return null;
  }

  const preserveStaticIPs = getPlanPreserveIP(plan);
  const excludedCount = getPlanVirtualMachines(plan).reduce(
    (count, vm) => count + (getVmExcludedNicsFromStaticIPs(vm)?.length ?? 0),
    0,
  );
  let preservationLabel = t('Do not preserve static IPs');
  if (preserveStaticIPs) {
    preservationLabel = t('Preserve static IPs on all vNICs');
    if (excludedCount > 0) {
      preservationLabel = t('Static IP preservation exclusions: {{excludedCount}}', {
        excludedCount,
      });
    }
  }

  return (
    <DetailsItem
      canEdit={canPatch && isPlanEditable(plan)}
      content={
        <Label color="grey" isCompact>
          {preservationLabel}
        </Label>
      }
      crumbs={['spec', 'preserveStaticIPs']}
      helpContent={t(`Preserve the static IPs of virtual machines migrated from vSphere.`)}
      onEdit={() => {
        launchOverlay<EditPlanProps>(EditPlanPreserveStaticIPs, { resource: plan });
      }}
      title={t('Preserve static IPs')}
    />
  );
};

export default PreserveStaticIPsDetailsItem;
