/**
 * Notices for the draw.io libraries that are vendor icon sets (third-party artwork, logos and
 * trademarks). draw.io (jgraph/drawio README, v32.4.1) states: "Some icons are originally defined
 * by third-party copyright holders; we have verified that all original licenses permit use in this
 * project." None of the sets below is marked as non-redistributable there, so all are included;
 * each gets a notice file under third_party/drawio-libraries/ and a short attribution that the
 * "More shapes" dialog shows (ⓘ). Libraries not listed here are draw.io's own stencils/shapes
 * (Apache-2.0 code, stencil terms in public/stencils/LICENSE).
 */
export interface LibraryInfo {
  /** Notice file, relative to the repository root. */
  notice?: string;
  /** Short attribution / trademark note. */
  attribution?: string;
  /** Fixed-colour vendor artwork: never recoloured (dark mode keeps the vendor colours). */
  vendorIcons?: boolean;
}

const N = (file: string): string => `third_party/drawio-libraries/${file}`;

export interface Vendor { file: string; name: string; attribution: string; libraries: string[]; terms?: string }

/** Vendor icon sets, one notice file each. */
export const VENDORS: Vendor[] = [
  { file: 'aws.md', name: 'Amazon Web Services', libraries: ['aws3', 'aws4b', 'aws4', 'aws4r', 'aws3d'],
    terms: 'https://aws.amazon.com/architecture/icons/',
    attribution: 'AWS Architecture Icons. Amazon Web Services, AWS and the AWS service names and logos are trademarks of Amazon.com, Inc. or its affiliates.' },
  { file: 'microsoft.md', name: 'Microsoft', libraries: ['azure', 'azure2', 'mscae', 'office', 'dynamics365', 'active_directory'],
    terms: 'https://learn.microsoft.com/azure/architecture/icons/',
    attribution: 'Microsoft product icons (Azure, Microsoft 365/Office, Dynamics 365, Active Directory). Microsoft and the product names are trademarks of the Microsoft group of companies.' },
  { file: 'google-cloud.md', name: 'Google Cloud', libraries: ['gcp2', 'gcp3', 'gcpicons'],
    terms: 'https://cloud.google.com/icons',
    attribution: 'Google Cloud icons. Google Cloud and the product names and logos are trademarks of Google LLC.' },
  { file: 'google-material.md', name: 'Google (Material Design, Android)', libraries: ['gmdl', 'android'],
    attribution: 'Material Design and Android UI shapes. Android and Material Design are trademarks of Google LLC.' },
  { file: 'apple.md', name: 'Apple', libraries: ['ios'],
    attribution: 'iOS user interface mockup shapes. iOS, iPhone and iPad are trademarks of Apple Inc. Not affiliated with or endorsed by Apple.' },
  { file: 'cisco.md', name: 'Cisco', libraries: ['cisco', 'cisco19', 'cisco_safe'],
    terms: 'https://www.cisco.com/c/en/us/about/brand-center/network-topology-icons.html',
    attribution: 'Cisco network topology icons. Cisco and the Cisco logo are trademarks of Cisco Systems, Inc. and/or its affiliates.' },
  { file: 'ibm.md', name: 'IBM', libraries: ['ibm', 'ibm_cloud'],
    attribution: 'IBM / IBM Cloud architecture icons. IBM and IBM Cloud are trademarks of International Business Machines Corporation.' },
  { file: 'alibaba-cloud.md', name: 'Alibaba Cloud', libraries: ['alibaba_cloud'],
    attribution: 'Alibaba Cloud product icons. Alibaba Cloud is a trademark of Alibaba Group Holding Limited.' },
  { file: 'salesforce.md', name: 'Salesforce', libraries: ['salesforce'],
    attribution: 'Salesforce icons. Salesforce and the product names are trademarks of Salesforce, Inc.' },
  { file: 'sap.md', name: 'SAP', libraries: ['sap'],
    attribution: 'SAP BTP and SAP product icons. SAP and the SAP product names are trademarks of SAP SE.' },
  { file: 'veeam.md', name: 'Veeam', libraries: ['veeam', 'veeam2'],
    attribution: 'Veeam stencils. Veeam and the product names are trademarks of Veeam Software.' },
  { file: 'citrix.md', name: 'Citrix', libraries: ['citrix', 'citrix2'],
    attribution: 'Citrix icons. Citrix and NetScaler are trademarks of Cloud Software Group, Inc.' },
  { file: 'vmware.md', name: 'VMware', libraries: ['vvd'],
    attribution: 'VMware Validated Design icons. VMware is a trademark of Broadcom Inc. and/or its subsidiaries.' },
  { file: 'kubernetes.md', name: 'Kubernetes', libraries: ['kubernetes'],
    terms: 'https://github.com/kubernetes/community/tree/master/icons',
    attribution: 'Kubernetes icons. Kubernetes is a registered trademark of The Linux Foundation.' },
  { file: 'openstack.md', name: 'OpenStack', libraries: ['openstack'],
    attribution: 'OpenStack icons. OpenStack is a registered trademark of the OpenInfra Foundation.' },
  { file: 'atlassian.md', name: 'Atlassian', libraries: ['atlassian', 'atlassian2'],
    attribution: 'Atlassian product icons and logos. Atlassian, Jira and Confluence are trademarks of Atlassian. draw.io\'s terms forbid using its icon sets in Atlassian products.' },
  { file: 'allied-telesis.md', name: 'Allied Telesis', libraries: ['allied_telesis'],
    attribution: 'Allied Telesis product icons. Allied Telesis is a trademark of Allied Telesis Holdings K.K.' },
  { file: 'cumulus.md', name: 'Cumulus Networks', libraries: ['cumulus'],
    attribution: 'Cumulus Networks icons. Cumulus Networks is a trademark of NVIDIA Corporation.' },
  { file: 'bootstrap.md', name: 'Bootstrap', libraries: ['bootstrap'],
    attribution: 'Bootstrap UI mockup shapes. Bootstrap is a project of its authors; not affiliated.' },
  { file: 'web-logos.md', name: 'Web icons and logos', libraries: ['webicons'],
    attribution: 'Web icons and logos of third-party services. All logos and trademarks belong to their respective owners.' },
  { file: 'rack-vendors.md', name: 'Rack equipment vendors', libraries: ['rack'],
    attribution: 'Rack equipment drawings (APC, Cisco, Dell, F5, HP/HPE Aruba, IBM, Oracle, ...). Product names are trademarks of their owners.' },
];

/** Libraries whose entries are vendor artwork drawn as images or fixed-colour stencils. */
const FIXED_COLOUR = new Set(['aws3', 'aws4b', 'aws4', 'aws4r', 'aws3d', 'azure', 'azure2', 'mscae', 'office', 'dynamics365',
  'active_directory', 'gcp2', 'gcp3', 'gcpicons', 'cisco19', 'cisco_safe', 'ibm', 'ibm_cloud', 'alibaba_cloud', 'salesforce',
  'sap', 'veeam', 'veeam2', 'citrix', 'citrix2', 'vvd', 'kubernetes', 'openstack', 'atlassian', 'atlassian2', 'allied_telesis',
  'cumulus', 'webicons', 'clipart']);

export function libraryInfo(id: string): LibraryInfo {
  const v = VENDORS.find((x) => x.libraries.includes(id));
  const out: LibraryInfo = {};
  if (v) { out.notice = N(v.file); out.attribution = v.attribution; }
  if (FIXED_COLOUR.has(id)) out.vendorIcons = true;
  return out;
}
