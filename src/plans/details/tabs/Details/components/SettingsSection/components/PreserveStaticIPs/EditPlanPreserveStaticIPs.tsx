import { useMemo, useState } from 'react';
import StaticIpNicSelectionTable from 'src/plans/components/StaticIpNicSelectionTable';
import { StaticIpSelectionMode } from 'src/plans/create/steps/other-settings/constants';
import usePlanSourceProvider from 'src/plans/details/hooks/usePlanSourceProvider';
import type { StaticIpExclusions } from 'src/plans/utils/staticIpPreservation/staticIpNicRows';
import { useInventoryVms } from 'src/utils/hooks/useInventoryVms';

import { HelpIconPopover } from '@components/common/HelpIconPopover/HelpIconPopover';
import ModalForm from '@components/ModalForm/ModalForm';
import type { OverlayComponent } from '@openshift-console/dynamic-plugin-sdk/lib/app/modal-support/OverlayProvider';
import { Alert, AlertVariant, Checkbox, ModalVariant, Radio, Stack } from '@patternfly/react-core';
import { getPlanPreserveIP } from '@utils/crds/plans/selectors';
import { isEmpty } from '@utils/helpers';
import { useForkliftTranslation } from '@utils/i18n';

import type { EditPlanProps } from '../../utils/types';

import { getPlanStaticIpNicInventory } from './utils/getPlanStaticIpNicInventory';
import { getPlanNicExclusions, onConfirmPreserveStaticIPs } from './utils/utils';

const EditPlanPreserveStaticIPs: OverlayComponent<EditPlanProps> = ({ closeOverlay, resource }) => {
  const { t } = useForkliftTranslation();
  const [value, setValue] = useState<boolean>(Boolean(getPlanPreserveIP(resource)));
  const [exclusions, setExclusions] = useState<StaticIpExclusions>(() =>
    getPlanNicExclusions(resource),
  );
  const [selectionMode, setSelectionMode] = useState<StaticIpSelectionMode>(() =>
    Object.values(getPlanNicExclusions(resource)).some((macs) => !isEmpty(macs))
      ? StaticIpSelectionMode.Manual
      : StaticIpSelectionMode.All,
  );
  const { loaded, loadError, sourceProvider } = usePlanSourceProvider(resource);
  const [inventoryVms, inventoryLoading, inventoryError] = useInventoryVms(
    { provider: sourceProvider },
    value && selectionMode === StaticIpSelectionMode.Manual && loaded,
    loadError,
  );
  const { isComplete, rows } = useMemo(
    () => getPlanStaticIpNicInventory(resource, inventoryVms, exclusions),
    [exclusions, inventoryVms, resource],
  );
  const inventoryUnavailable = Boolean(loadError ?? inventoryError);
  const manualSelectionUnavailable =
    value &&
    selectionMode === StaticIpSelectionMode.Manual &&
    (!loaded || inventoryLoading || inventoryUnavailable || !isComplete || isEmpty(rows));

  return (
    <ModalForm
      closeOverlay={closeOverlay}
      description={t(
        'Deselect vNICs whose static IPs should not be preserved. Selected vNICs also follow the network mapping IP mode.',
      )}
      headerHelp={
        <HelpIconPopover header={t('Preserve static IPs')}>
          {t(
            'By default, vNICs change during migration and static IPs linked to interface names are lost. Enable to preserve static IP configurations.',
          )}
        </HelpIconPopover>
      }
      isDisabled={manualSelectionUnavailable}
      onConfirm={async () =>
        onConfirmPreserveStaticIPs({
          exclusions,
          newValue: value,
          resource,
          rows,
          selectionMode,
        })
      }
      title={t('Edit static IPs')}
      variant={ModalVariant.large}
    >
      <Stack hasGutter>
        <Checkbox
          data-testid="preserve-static-ips-checkbox"
          id="preserve-static-ips-checkbox"
          isChecked={value}
          label={t('Preserve static IPs')}
          onChange={(_, checked) => {
            setValue(checked);
          }}
        />
        {value && (
          <>
            <Radio
              id="edit-static-ips-all-nics"
              isChecked={selectionMode === StaticIpSelectionMode.All}
              label={t('All vNICs')}
              name="edit-static-ip-selection-mode"
              onChange={() => {
                setSelectionMode(StaticIpSelectionMode.All);
              }}
            />
            <Radio
              id="edit-static-ips-select-nics"
              isChecked={selectionMode === StaticIpSelectionMode.Manual}
              label={t('Select vNICs')}
              name="edit-static-ip-selection-mode"
              onChange={() => {
                setSelectionMode(StaticIpSelectionMode.Manual);
              }}
            />
            {selectionMode === StaticIpSelectionMode.Manual && (
              <>
                {(!loaded || inventoryLoading) && <p>{t('Loading vNICs...')}</p>}
                {inventoryUnavailable && (
                  <Alert
                    isInline
                    title={t('Unable to load vNICs from the source provider.')}
                    variant={AlertVariant.danger}
                  />
                )}
                {loaded && !inventoryUnavailable && !inventoryLoading && !isComplete && (
                  <Alert
                    isInline
                    title={t('Some vNICs could not be loaded from the source provider.')}
                    variant={AlertVariant.info}
                  />
                )}
                {loaded && !inventoryLoading && !inventoryUnavailable && isComplete && (
                  <StaticIpNicSelectionTable
                    exclusions={exclusions}
                    onChange={setExclusions}
                    rows={rows}
                  />
                )}
              </>
            )}
          </>
        )}
      </Stack>
    </ModalForm>
  );
};

export default EditPlanPreserveStaticIPs;
