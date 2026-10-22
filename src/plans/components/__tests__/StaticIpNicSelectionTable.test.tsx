import { describe, expect, it, jest } from '@jest/globals';
import { mockI18n } from '@test-utils/mockI18n';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';

import type { StaticIpNicRow } from '../../utils/staticIpPreservation/staticIpNicRows';
import StaticIpNicSelectionTable from '../StaticIpNicSelectionTable';

mockI18n();

const rows: StaticIpNicRow[] = [
  {
    ipAddresses: ['192.0.2.10', '2001:db8::10'],
    mac: 'AA:BB:CC:DD:EE:01',
    networkName: 'source-network',
    vmId: 'vm-1',
    vmName: 'VM one',
  },
  {
    ipAddresses: [],
    mac: 'AA:BB:CC:DD:EE:02',
    networkName: '',
    vmId: 'vm-1',
    vmName: 'VM one',
  },
];

describe('StaticIpNicSelectionTable', () => {
  it('defaults to preserving every NIC and shows source context', () => {
    render(<StaticIpNicSelectionTable exclusions={{}} onChange={jest.fn()} rows={rows} />);

    expect(screen.getByTestId('static-ip-nic-selection-table')).toBeInTheDocument();
    expect(screen.getByText('source-network')).toBeInTheDocument();
    expect(screen.getByText('192.0.2.10, 2001:db8::10')).toBeInTheDocument();
    expect(screen.getByText('None reported')).toBeInTheDocument();
    expect(screen.getByTestId('static-ip-nic-checkbox-vm-1-AA:BB:CC:DD:EE:01')).toBeChecked();
    expect(screen.getByTestId('static-ip-nic-checkbox-vm-1-AA:BB:CC:DD:EE:01')).toHaveAttribute(
      'aria-label',
    );
    expect(screen.getByTestId('static-ip-nic-checkbox-vm-1-AA:BB:CC:DD:EE:02')).toBeChecked();
  });

  it('reports an exclusion and reflects controlled selection updates', async () => {
    const onChange = jest.fn();
    const user = userEvent.setup();
    const { rerender } = render(
      <StaticIpNicSelectionTable exclusions={{}} onChange={onChange} rows={rows} />,
    );
    const firstCheckbox = screen.getByTestId('static-ip-nic-checkbox-vm-1-AA:BB:CC:DD:EE:01');

    await user.click(firstCheckbox);
    expect(onChange).toHaveBeenCalledWith({ 'vm-1': ['AA:BB:CC:DD:EE:01'] });

    rerender(
      <StaticIpNicSelectionTable
        exclusions={{ 'vm-1': ['aa-bb-cc-dd-ee-01'] }}
        onChange={onChange}
        rows={rows}
      />,
    );
    expect(firstCheckbox).not.toBeChecked();
    expect(screen.getByTestId('static-ip-nic-checkbox-vm-1-AA:BB:CC:DD:EE:02')).toBeChecked();

    await user.click(firstCheckbox);
    expect(onChange).toHaveBeenLastCalledWith({});
  });

  it('renders an empty state when selected VMs have no NIC details', () => {
    render(<StaticIpNicSelectionTable exclusions={{}} onChange={jest.fn()} rows={[]} />);

    expect(screen.getByTestId('static-ip-nic-selection-empty')).toBeInTheDocument();
  });
});
