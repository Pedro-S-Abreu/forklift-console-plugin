import { type FC, useMemo } from 'react';
import { Controller, useWatch } from 'react-hook-form';
import StaticIpNicSelectionTable from 'src/plans/components/StaticIpNicSelectionTable';
import { getStaticIpNicRows } from 'src/plans/utils/staticIpPreservation/staticIpNicRows';

import { FormGroup, FormHelperText, Radio, Stack } from '@patternfly/react-core';
import { isEmpty } from '@utils/helpers';
import { useForkliftTranslation } from '@utils/i18n';

import { useCreatePlanFormContext } from '../../hooks/useCreatePlanFormContext';
import { VmFormFieldId } from '../virtual-machines/constants';

import { OtherSettingsFormFieldId, StaticIpSelectionMode } from './constants';

const StaticIpSelectionField: FC = () => {
  const { t } = useForkliftTranslation();
  const { control } = useCreatePlanFormContext();
  const [preserveStaticIps, selectionMode, vms] = useWatch({
    control,
    name: [
      OtherSettingsFormFieldId.PreserveStaticIps,
      OtherSettingsFormFieldId.StaticIpSelectionMode,
      VmFormFieldId.Vms,
    ],
  });
  const rows = useMemo(() => getStaticIpNicRows(Object.values(vms ?? {})), [vms]);

  if (!preserveStaticIps) {
    return null;
  }

  return (
    <FormGroup fieldId={OtherSettingsFormFieldId.StaticIpSelectionMode} label={t('vNIC selection')}>
      <Stack hasGutter>
        <FormHelperText>
          {t(
            'Deselect vNICs whose static IPs should not be preserved. Selected vNICs also follow the network mapping IP mode.',
          )}
        </FormHelperText>
        <Controller
          control={control}
          defaultValue={StaticIpSelectionMode.All}
          name={OtherSettingsFormFieldId.StaticIpSelectionMode}
          render={({ field }) => (
            <Stack hasGutter>
              <Radio
                data-testid="preserve-static-ips-all-nics"
                id="preserve-static-ips-all-nics"
                isChecked={field.value === StaticIpSelectionMode.All}
                label={t('All vNICs')}
                name={field.name}
                onChange={() => {
                  field.onChange(StaticIpSelectionMode.All);
                }}
                value={StaticIpSelectionMode.All}
              />
              <Radio
                data-testid="preserve-static-ips-select-nics"
                id="preserve-static-ips-select-nics"
                isChecked={field.value === StaticIpSelectionMode.Manual}
                isDisabled={isEmpty(rows)}
                label={t('Select vNICs')}
                name={field.name}
                onChange={() => {
                  field.onChange(StaticIpSelectionMode.Manual);
                }}
                value={StaticIpSelectionMode.Manual}
              />
            </Stack>
          )}
        />
        {selectionMode === StaticIpSelectionMode.Manual && !isEmpty(rows) && (
          <Controller
            control={control}
            defaultValue={{}}
            name={OtherSettingsFormFieldId.ExcludedNicsFromStaticIPs}
            render={({ field }) => (
              <StaticIpNicSelectionTable
                exclusions={field.value ?? {}}
                onChange={field.onChange}
                rows={rows}
              />
            )}
          />
        )}
        {isEmpty(rows) && (
          <FormHelperText>
            {t('vNICs will appear after you select VMs with network interfaces.')}
          </FormHelperText>
        )}
      </Stack>
    </FormGroup>
  );
};

export default StaticIpSelectionField;
