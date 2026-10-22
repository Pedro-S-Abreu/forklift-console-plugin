import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { PROVIDER_TYPES } from '@utils/providers/constants';

import type { CreatePlanFormData } from '../../../types';
import { VmFormFieldId } from '../../virtual-machines/constants';
import { OtherSettingsFormFieldId, StaticIpSelectionMode } from '../constants';
import StaticIpSelectionField from '../StaticIpSelectionField';

const mockUseCreatePlanFormContext = jest.fn();
jest.mock('../../../hooks/useCreatePlanFormContext', () => ({
  useCreatePlanFormContext: (): ReturnType<typeof mockUseCreatePlanFormContext> =>
    mockUseCreatePlanFormContext(),
}));

const vm = {
  id: 'vm-1',
  name: 'web-1',
  providerType: PROVIDER_TYPES.vsphere,
  nics: [
    { mac: 'aa:bb:cc:dd:ee:01', network: { name: 'management' } },
    { mac: 'aa:bb:cc:dd:ee:02', network: { name: 'backup' } },
  ],
  guestNetworks: [{ mac: 'AA:BB:CC:DD:EE:01', ip: '192.0.2.10', origin: 'manual' }],
};

const mockReadValues = jest.fn();

const TestForm = ({ preserveStaticIps = true }: { preserveStaticIps?: boolean }): ReactElement => {
  const methods = useForm<CreatePlanFormData>({
    defaultValues: {
      [OtherSettingsFormFieldId.ExcludedNicsFromStaticIPs]: {},
      [OtherSettingsFormFieldId.PreserveStaticIps]: preserveStaticIps,
      [OtherSettingsFormFieldId.StaticIpSelectionMode]: StaticIpSelectionMode.All,
      [VmFormFieldId.Vms]: { [vm.id]: vm },
    },
  });
  mockUseCreatePlanFormContext.mockReturnValue({ control: methods.control });

  return (
    <FormProvider {...methods}>
      <StaticIpSelectionField />
      <button
        onClick={() => {
          mockReadValues(methods.getValues());
        }}
        type="button"
      >
        Read form
      </button>
    </FormProvider>
  );
};

describe('StaticIpSelectionField', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('defaults to all vNICs and records a manual choice on the selected VM', async () => {
    const user = userEvent.setup();
    render(<TestForm />);

    expect(screen.getByRole('radio', { name: 'All vNICs' })).toBeChecked();
    expect(screen.queryByTestId('static-ip-nic-selection-table')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Select vNICs' }));

    expect(screen.getByTestId('static-ip-nic-selection-table')).toBeInTheDocument();
    expect(screen.getByText('192.0.2.10')).toBeInTheDocument();
    const backupNic = screen.getByTestId('static-ip-nic-checkbox-vm-1-aa:bb:cc:dd:ee:02');
    expect(backupNic).toBeChecked();
    await user.click(backupNic);

    expect(backupNic).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Read form' }));
    expect(mockReadValues).toHaveBeenCalledWith(
      expect.objectContaining({
        [OtherSettingsFormFieldId.StaticIpSelectionMode]: StaticIpSelectionMode.Manual,
        [OtherSettingsFormFieldId.ExcludedNicsFromStaticIPs]: { 'vm-1': ['aa:bb:cc:dd:ee:02'] },
      }),
    );
  });

  it('hides vNIC selection when global preservation is off', () => {
    render(<TestForm preserveStaticIps={false} />);

    expect(screen.queryByRole('radio', { name: 'All vNICs' })).not.toBeInTheDocument();
  });
});
