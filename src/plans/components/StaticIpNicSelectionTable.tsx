import type { FC } from 'react';

import { Checkbox } from '@patternfly/react-core';
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { isEmpty } from '@utils/helpers';
import { useForkliftTranslation } from '@utils/i18n';

import {
  getEffectiveStaticIpExclusions,
  type StaticIpExclusions,
  type StaticIpNicRow,
} from '../utils/staticIpPreservation/staticIpNicRows';

type StaticIpNicSelectionTableProps = {
  exclusions: StaticIpExclusions;
  onChange: (exclusions: StaticIpExclusions) => void;
  rows: StaticIpNicRow[];
};

const StaticIpNicSelectionTable: FC<StaticIpNicSelectionTableProps> = ({
  exclusions,
  onChange,
  rows,
}) => {
  const { t } = useForkliftTranslation();
  const effectiveExclusions = getEffectiveStaticIpExclusions(rows, exclusions);

  const setPreserved = (row: StaticIpNicRow, preserve: boolean): void => {
    const current = effectiveExclusions[row.vmId] ?? [];
    const nextVmExclusions = preserve
      ? current.filter((mac) => mac !== row.mac)
      : [...current, row.mac];
    const nextExclusions = { ...effectiveExclusions };

    if (isEmpty(nextVmExclusions)) {
      delete nextExclusions[row.vmId];
    } else {
      nextExclusions[row.vmId] = nextVmExclusions;
    }

    onChange(nextExclusions);
  };

  if (isEmpty(rows)) {
    return (
      <p data-testid="static-ip-nic-selection-empty">
        {t('No network interfaces are available for the selected virtual machines.')}
      </p>
    );
  }

  return (
    <Table
      aria-label={t('Static IP preservation by network interface')}
      data-testid="static-ip-nic-selection-table"
      variant={TableVariant.compact}
    >
      <Thead>
        <Tr>
          <Th>{t('Preserve')}</Th>
          <Th>{t('Virtual machine')}</Th>
          <Th>{t('Source network')}</Th>
          <Th>{t('MAC address')}</Th>
          <Th>{t('Reported manual IPs')}</Th>
        </Tr>
      </Thead>
      <Tbody>
        {rows.map((row) => (
          <Tr
            data-testid={`static-ip-nic-row-${row.vmId}-${row.mac}`}
            key={`${row.vmId}-${row.mac}`}
          >
            <Td dataLabel={t('Preserve')}>
              <Checkbox
                aria-label={t('Preserve static IP for {{vmName}} NIC {{mac}}', {
                  mac: row.mac,
                  vmName: row.vmName,
                })}
                data-testid={`static-ip-nic-checkbox-${row.vmId}-${row.mac}`}
                id={`static-ip-nic-${row.vmId}-${row.mac}`}
                isChecked={!effectiveExclusions[row.vmId]?.includes(row.mac)}
                onChange={(_event, checked) => {
                  setPreserved(row, checked);
                }}
              />
            </Td>
            <Td dataLabel={t('Virtual machine')}>{row.vmName}</Td>
            <Td dataLabel={t('Source network')}>{row.networkName || t('Unknown network')}</Td>
            <Td dataLabel={t('MAC address')}>{row.mac}</Td>
            <Td dataLabel={t('Reported manual IPs')}>
              {isEmpty(row.ipAddresses) ? t('None reported') : row.ipAddresses.join(', ')}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
};

export default StaticIpNicSelectionTable;
