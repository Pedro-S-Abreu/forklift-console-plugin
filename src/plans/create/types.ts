import type { FieldValues } from 'react-hook-form';
import type { TargetPowerState } from 'src/plans/constants';
import type { InventoryNetwork } from 'src/utils/hooks/useNetworks';
import type { InventoryStorage } from 'src/utils/hooks/useStorages';
import type { Ec2Network } from 'src/utils/types/ec2Inventory';

import type {
  HypervNetwork,
  IoK8sApiCoreV1ConfigMap,
  IoK8sApiCoreV1Secret,
  OpenShiftNetworkAttachmentDefinition,
  OpenshiftVM,
  OpenstackNetwork,
  OpenstackVM,
  OvaNetwork,
  OvaVM,
  OVirtNetwork,
  OVirtNicProfile,
  OVirtVM,
  V1beta1NetworkMap,
  V1beta1PlanSpecTransferNetwork,
  V1beta1Provider,
  V1beta1StorageMap,
  V1NetworkAttachmentDefinition,
  VSphereNetwork,
  VSphereVM,
} from '@forklift-ui/types';
import type { NetworkMapFieldId, NetworkMapping } from '@utils/mappings/networkMap';
import type { StorageMapping, TargetStorage } from '@utils/storage/types';
import type { MappingValue } from '@utils/types';

import type {
  CustomScriptsFieldId,
  CustomScriptsType,
} from './steps/customization-scripts/constants';
import type { CustomScript } from './steps/customization-scripts/types';
import type { GeneralFormFieldId } from './steps/general-information/constants';
import type {
  AapFormFieldId,
  HooksFormFieldId,
  HookSource,
  MigrationHook,
} from './steps/migration-hooks/constants';
import type { MigrationTypeFieldId, MigrationTypeValue } from './steps/migration-type/constants';
import type {
  DiskDecryptionType,
  DiskPassPhrase,
  OtherSettingsFormFieldId,
  StaticIpSelectionMode,
} from './steps/other-settings/constants';
import type { CreatePlanStorageMapFieldId } from './steps/storage-map/constants';
import type { VmFormFieldId } from './steps/virtual-machines/constants';

export type ProviderNetwork =
  | (Omit<OpenShiftNetworkAttachmentDefinition, 'object'> & {
      object: V1NetworkAttachmentDefinition | undefined;
    })
  | OpenstackNetwork
  | OVirtNetwork
  | VSphereNetwork
  | OvaNetwork
  | HypervNetwork
  | Ec2Network;

type VsphereVirtualMachine = VSphereVM & {
  changeTrackingEnabled: boolean;
};

export type ProviderVirtualMachine =
  VsphereVirtualMachine | OpenshiftVM | OVirtVM | OpenstackVM | OvaVM;

export type CreatePlanFormData = FieldValues & {
  [AapFormFieldId.AapPostHookJobTemplateId]: number | undefined;
  [AapFormFieldId.AapPostHookJobTemplateName]: string | undefined;
  [AapFormFieldId.AapPreHookJobTemplateId]: number | undefined;
  [AapFormFieldId.AapPreHookJobTemplateName]: string | undefined;
  [AapFormFieldId.HookSource]: HookSource;
  [CreatePlanStorageMapFieldId.ExistingStorageMap]: V1beta1StorageMap | undefined;
  [CreatePlanStorageMapFieldId.StorageMap]: StorageMapping[];
  [CreatePlanStorageMapFieldId.StorageMapName]: string;
  [CustomScriptsFieldId.ExistingConfigMap]: IoK8sApiCoreV1ConfigMap | undefined;
  [CustomScriptsFieldId.Scripts]: CustomScript[];
  [CustomScriptsFieldId.ScriptsType]: CustomScriptsType;
  [GeneralFormFieldId.PlanDescription]: string | undefined;
  [GeneralFormFieldId.PlanName]: string;
  [GeneralFormFieldId.PlanProject]: string;
  [GeneralFormFieldId.ShowDefaultProjects]: boolean;
  [GeneralFormFieldId.SourceProvider]: V1beta1Provider | undefined;
  [GeneralFormFieldId.TargetProject]: string;
  [GeneralFormFieldId.TargetProvider]: V1beta1Provider | undefined;
  [HooksFormFieldId.PostMigration]: MigrationHook;
  [HooksFormFieldId.PreMigration]: MigrationHook;
  [MigrationTypeFieldId.MigrationType]: MigrationTypeValue;
  [NetworkMapFieldId.ExistingNetworkMap]: V1beta1NetworkMap | undefined;
  [NetworkMapFieldId.NetworkMap]: NetworkMapping[];
  [NetworkMapFieldId.NetworkMapName]: string;
  [OtherSettingsFormFieldId.DiskDecryptionPassPhrases]: DiskPassPhrase[];
  [OtherSettingsFormFieldId.DiskDecryptionType]: DiskDecryptionType;
  [OtherSettingsFormFieldId.ExcludedNicsFromStaticIPs]: Record<string, string[]>;
  [OtherSettingsFormFieldId.ExistingLUKSSecret]: IoK8sApiCoreV1Secret | undefined;
  [OtherSettingsFormFieldId.InstanceTypes]: Record<string, string>;
  [OtherSettingsFormFieldId.MigrateSharedDisks]: boolean;
  [OtherSettingsFormFieldId.NBDEClevis]: boolean;
  [OtherSettingsFormFieldId.PreserveStaticIps]: boolean;
  [OtherSettingsFormFieldId.RootDevice]: string;
  [OtherSettingsFormFieldId.StaticIpSelectionMode]: StaticIpSelectionMode;
  [OtherSettingsFormFieldId.TargetPowerState]: TargetPowerState;
  [OtherSettingsFormFieldId.TransferNetwork]: V1beta1PlanSpecTransferNetwork;
  [VmFormFieldId.Vms]: Record<string, ProviderVirtualMachine>;
};

export type MappingFieldIds = {
  mapField: string;
  sourceField: string;
  targetField: string;
};

export type CategorizedSourceMappings = {
  other: MappingValue[];
  used: MappingValue[];
};

type ResourceQueryResult<T> = [T, boolean, Error | null];

export type CreatePlanWizardContextProps = {
  network: {
    oVirtNicProfiles: ResourceQueryResult<OVirtNicProfile[]>;
    sources: ResourceQueryResult<InventoryNetwork[]>;
    targets: ResourceQueryResult<OpenShiftNetworkAttachmentDefinition[]>;
  };
  storage: {
    sources: ResourceQueryResult<InventoryStorage[]>;
    targets: ResourceQueryResult<TargetStorage[]>;
  };
  vmsWithDisks: ResourceQueryResult<ProviderVirtualMachine[]>;
};
