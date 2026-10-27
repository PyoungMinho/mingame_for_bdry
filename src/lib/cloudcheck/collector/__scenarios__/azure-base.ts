// src/lib/cloudcheck/collector/__scenarios__/azure-base.ts — Azure 기본 시나리오(가짜 회사 '예시상회', 테넌트 …0001)
// Azure CLI(az)가 내는 모양(camelCase, 리소스 ID는 resourceGroups·Microsoft.* 표기)을 흉내 낸다.
// 읽으면 안 되는 필드(키 생성 외 속성, 엔드포인트, 태그, 설명, IP 값)에는 POISON 표식을 넣어 출력에 나오는지 본다.
import type { ShimEntry } from "../testkit";
import { out } from "./types";

export const AZ_TENANT = "00000000-0000-0000-0000-000000000001";
export const AZ_OTHER_TENANT = "00000000-0000-0000-0000-000000000002";
export const AZ_SUB = "00000000-0000-0000-0000-000000000011";       // 사용 가능(조회 대상)
export const AZ_SUB_DISABLED = "00000000-0000-0000-0000-000000000012";
export const AZ_SUB_FOREIGN = "00000000-0000-0000-0000-000000000013"; // 다른 테넌트 — 호출하지 않는다
export const AZ_ST_WEB = `/subscriptions/${AZ_SUB}/resourceGroups/rg-web/providers/Microsoft.Storage/storageAccounts/stwebfiles01`;
export const AZ_ST_LOGS = `/subscriptions/${AZ_SUB}/resourceGroups/rg-ops/providers/Microsoft.Storage/storageAccounts/stlogsarchive02`;
export const AZ_NSG = `/subscriptions/${AZ_SUB}/resourceGroups/rg-web/providers/Microsoft.Network/networkSecurityGroups/nsg-web`;
export const AZ_NIC = `/subscriptions/${AZ_SUB}/resourceGroups/rg-web/providers/Microsoft.Network/networkInterfaces/nic-web1`;
export const AZ_PIP = `/subscriptions/${AZ_SUB}/resourceGroups/rg-web/providers/Microsoft.Network/publicIPAddresses/pip-web`;
const SUBNET = `/subscriptions/${AZ_SUB}/resourceGroups/rg-web/providers/Microsoft.Network/virtualNetworks/vnet-web/subnets/snet-app`;

const account = (id: string, name: string, extra: Record<string, unknown>): Record<string, unknown> => ({
  id, name, kind: "StorageV2", location: "koreacentral", type: "Microsoft.Storage/storageAccounts",
  primaryEndpoints: { blob: `https://${name}.blob.core.windows.net/`, web: "https://POISON-endpoint.example.com/" },
  tags: { owner: "POISON-tag" }, sku: { name: "Standard_LRS" },
  encryption: { keySource: "Microsoft.Storage", keyVaultProperties: { keyName: "POISON-key-name" } },
  ...extra,
});

/** 기본(정상) 시나리오 */
export function azureBase(): Record<string, ShimEntry | readonly ShimEntry[]> {
  const sub = (id: string, name: string, state: string, tenantId: string): Record<string, unknown> => ({
    cloudName: "AzureCloud", homeTenantId: tenantId, id, isDefault: id === AZ_SUB, managedByTenants: [], name, state, tenantId,
    user: { name: "kim@example.com", type: "user" },
  });
  return {
    "account show": out({
      environmentName: "AzureCloud", homeTenantId: AZ_TENANT, id: AZ_SUB, isDefault: true, managedByTenants: [], name: "예시상회 운영", state: "Enabled", tenantId: AZ_TENANT,
      user: { name: "kim@example.com", type: "user" },
    }),
    "account list": out([
      sub(AZ_SUB, "예시상회 운영", "Enabled", AZ_TENANT),
      sub(AZ_SUB_DISABLED, "예시상회 보관", "Disabled", AZ_TENANT),
      sub(AZ_SUB_FOREIGN, "협력사 구독", "Enabled", AZ_OTHER_TENANT),
    ]),
    [`storage account list@${AZ_SUB}`]: out([
      account(AZ_ST_WEB, "stwebfiles01", {
        allowBlobPublicAccess: true, allowSharedKeyAccess: true, publicNetworkAccess: "Enabled",
        keyCreationTime: { key1: "2025-01-10T00:00:00.1234567+00:00", key2: null },
        keyPolicy: null, sasPolicy: null, networkRuleSet: { defaultAction: "Allow", bypass: "AzureServices", ipRules: [{ value: "203.0.113.5" }] },
      }),
      account(AZ_ST_LOGS, "stlogsarchive02", {
        allowBlobPublicAccess: false, allowSharedKeyAccess: false, publicNetworkAccess: "Disabled",
        keyCreationTime: { key1: "2026-08-01T00:00:00.0000000+00:00", key2: "2026-08-01T00:00:00.0000000+00:00" },
        keyPolicy: { keyExpirationPeriodInDays: 90 }, sasPolicy: { sasExpirationPeriod: "1.00:00:00", expirationAction: "Log" },
        networkRuleSet: { defaultAction: "Deny", bypass: "AzureServices" },
      }),
    ]),
    [`storage container-rm list#${AZ_ST_WEB}@${AZ_SUB}`]: out([
      { id: `${AZ_ST_WEB}/blobServices/default/containers/$web`, name: "$web", publicAccess: "None", metadata: { note: "POISON-metadata" } },
      { id: `${AZ_ST_WEB}/blobServices/default/containers/assets`, name: "assets", publicAccess: "Blob" },
    ]),
    [`storage container-rm list#${AZ_ST_LOGS}@${AZ_SUB}`]: out([{ id: `${AZ_ST_LOGS}/blobServices/default/containers/logs`, name: "logs", publicAccess: "None" }]),
    // 진단 설정 출력 형태 두 가지(value 래퍼 · 배열)를 모두 받는지 본다
    [`monitor diagnostic-settings list#${AZ_ST_WEB}/blobServices/default@${AZ_SUB}`]: out({ value: [] }),
    [`monitor diagnostic-settings list#${AZ_ST_LOGS}/blobServices/default@${AZ_SUB}`]: out([
      { name: "blob-to-law", workspaceId: `/subscriptions/${AZ_SUB}/resourceGroups/rg-ops/providers/Microsoft.OperationalInsights/workspaces/POISON-law`, storageAccountId: null, eventHubAuthorizationRuleId: null,
        logs: [{ category: "StorageRead", enabled: true }, { category: "StorageWrite", enabled: true }, { category: "StorageDelete", enabled: false }], metrics: [{ category: "Transaction", enabled: false }] },
    ]),
    [`monitor diagnostic-settings subscription list@${AZ_SUB}`]: out({ value: [
      { name: "activity-to-law", workspaceId: `/subscriptions/${AZ_SUB}/resourceGroups/rg-ops/providers/Microsoft.OperationalInsights/workspaces/POISON-law`, storageAccountId: null, eventHubAuthorizationRuleId: null,
        logs: [{ category: "Administrative", enabled: true }, { category: "Security", enabled: true }, { category: "Policy", enabled: false }] },
    ] }),
    [`network nsg list@${AZ_SUB}`]: out([{
      id: AZ_NSG, name: "nsg-web", location: "koreacentral", tags: { owner: "POISON-tag" },
      securityRules: [
        { name: "allow-rdp", direction: "Inbound", access: "Allow", priority: 100, protocol: "Tcp", sourceAddressPrefix: "*", sourceAddressPrefixes: [], destinationAddressPrefix: "10.0.1.4", destinationPortRange: "3389", destinationPortRanges: [], description: "POISON <img src=x onerror=alert(1)>" },
        { name: "allow-https", direction: "Inbound", access: "Allow", priority: 110, protocol: "Tcp", sourceAddressPrefix: null, sourceAddressPrefixes: ["Internet", "203.0.113.0/24"], sourceApplicationSecurityGroups: [{ id: "POISON-asg" }], destinationPortRange: null, destinationPortRanges: ["443", "8443-8444"] },
      ],
      defaultSecurityRules: [{ name: "AllowVnetInBound", direction: "Inbound", access: "Allow", priority: 65000, protocol: "*", sourceAddressPrefix: "VirtualNetwork", destinationPortRange: "*" }],
      networkInterfaces: [{ id: AZ_NIC }], subnets: [{ id: SUBNET }],
    }]),
    [`network nic list@${AZ_SUB}`]: out([{
      id: AZ_NIC, name: "nic-web1", networkSecurityGroup: { id: AZ_NSG }, macAddress: "00-0D-3A-00-00-01",
      ipConfigurations: [{ name: "ipconfig1", privateIPAddress: "10.0.1.4", subnet: { id: SUBNET }, publicIPAddress: { id: AZ_PIP } }],
    }]),
    [`network public-ip list@${AZ_SUB}`]: out([{
      id: AZ_PIP, name: "pip-web", ipAddress: "203.0.113.20", publicIPAllocationMethod: "Static", ipConfiguration: { id: `${AZ_NIC}/ipConfigurations/ipconfig1` },
      dnsSettings: { fqdn: "POISON-fqdn.koreacentral.cloudapp.azure.com" },
    }]),
  };
}
