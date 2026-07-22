export const SvgIcons = {
  // Basic shapes
  rectangle: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="14" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  circle: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  diamond: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  triangle: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3 L21 20 L3 20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  line: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <line x1="2" y1="12" x2="22" y2="12" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  arrow: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 12 L18 12 M18 12 L14 8 M18 12 L14 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `,

  // Flowchart shapes
  process: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="6" width="18" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  decision: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 L22 12 L12 22 L2 12 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  cylinder: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="5" rx="8" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="4" y1="5" x2="4" y2="17" stroke="currentColor" stroke-width="1.5"/>
      <line x1="20" y1="5" x2="20" y2="17" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="12" cy="19" rx="8" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  document: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 3 L20 3 L20 18 Q12 20 4 18 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  // UML shapes
  umlClass: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="3" y1="10" x2="21" y2="10" stroke="currentColor" stroke-width="1.5"/>
      <line x1="3" y1="16" x2="21" y2="16" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  umlUsecase: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="12" rx="8" ry="6" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  umlComponent: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="8" width="18" height="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <rect x="2" y="4" width="3" height="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <rect x="2" y="10" width="3" height="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  umlPackage: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 6 L9 6 L9 3 L21 3 L21 18 L3 18 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  umlState: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6 Q4 4 6 4 L18 4 Q20 4 20 6 L20 18 Q20 20 18 20 L6 20 Q4 20 4 18 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  umlActivity: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 7 Q4 5 6 5 L18 5 Q20 5 20 7 L20 17 Q20 19 18 19 L6 19 Q4 19 4 17 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  // Cloud/Infrastructure shapes
  cloud: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 15 Q3 15 3 12 Q3 10 5 9 Q5 6 8 6 Q10 3 13 3 Q17 3 19 6 Q21 6 22 8 Q23 10 22 12 Q22 15 19 15 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  database: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="5" rx="7" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <line x1="5" y1="5" x2="5" y2="15" stroke="currentColor" stroke-width="1.5"/>
      <line x1="19" y1="5" x2="19" y2="15" stroke="currentColor" stroke-width="1.5"/>
      <ellipse cx="12" cy="19" rx="7" ry="2.5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  // BPMN shapes
  bpmnEvent: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  bpmnTask: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  bpmnGateway: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  // Network shapes
  router: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="7" width="20" height="10" rx="1" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="6" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="18" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  `,

  server: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="4" width="18" height="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <rect x="3" y="11" width="18" height="5" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <circle cx="8" cy="6.5" r="1" fill="currentColor"/>
      <circle cx="8" cy="13.5" r="1" fill="currentColor"/>
    </svg>
  `,

  // Extended basic shapes
  hexagon: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 12 L9 4 L15 4 L18 12 L15 20 L9 20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  pentagon: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 L21 9 L18 21 L6 21 L3 9 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  star: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 L15 10 L23 10 L17 16 L20 24 L12 18 L4 24 L7 16 L1 10 L9 10 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  trapezoid: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 4 L19 4 L22 20 L2 20 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  cross: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <line x1="12" y1="3" x2="12" y2="21" stroke="currentColor" stroke-width="1.5"/>
      <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  oval: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <ellipse cx="12" cy="12" rx="9" ry="7" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  double_rectangle: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="20" height="16" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <rect x="5" y="7" width="14" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  lozenge: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3 L21 12 L12 21 L3 12 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  chevron: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5 L15 12 L3 19 L6 19 L18 12 L6 5 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  delay: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 5 Q6 4 7 4 L18 4 Q20 4 20 6 L20 18 Q20 20 18 20 L7 20 Q6 20 6 19 Q3 16 3 12 Q3 8 6 5" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  right_angle: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <line x1="18" y1="3" x2="18" y2="18" stroke="currentColor" stroke-width="1.5"/>
      <line x1="3" y1="18" x2="18" y2="18" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,

  rounded_rect_basic: () => `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6 Q4 4 6 4 L18 4 Q20 4 20 6 L20 18 Q20 20 18 20 L6 20 Q4 20 4 18 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
    </svg>
  `,
};

// Map shape IDs to icon function names
const iconMap: Record<string, keyof typeof SvgIcons> = {
  // Basic
  rectangle: 'rectangle',
  circle: 'circle',
  diamond: 'diamond',
  triangle: 'triangle',
  line: 'line',
  rounded_rectangle: 'rectangle',
  // Flowchart
  process: 'process',
  decision: 'decision',
  cylinder: 'cylinder',
  document: 'document',
  data: 'diamond',
  terminator: 'process',
  loop: 'process',
  parallelogram: 'triangle',
  // Arrows
  arrow_right: 'arrow',
  arrow_left: 'arrow',
  arrow_up: 'arrow',
  arrow_down: 'arrow',
  double_arrow: 'arrow',
  // UML
  uml_class: 'umlClass',
  uml_interface: 'umlClass',
  uml_object: 'umlClass',
  uml_component: 'umlComponent',
  uml_artifact: 'document',
  uml_package: 'umlPackage',
  uml_actor: 'circle',
  uml_usecase: 'umlUsecase',
  uml_state: 'umlState',
  uml_initial_state: 'bpmnEvent',
  uml_final_state: 'bpmnEvent',
  uml_activity: 'umlActivity',
  uml_fork_join: 'line',
  uml_decision: 'decision',
  uml_merge: 'decision',
  // Sequence Diagrams
  uml_lifeline: 'line',
  uml_activation_box: 'rectangle',
  uml_message_arrow: 'arrow',
  uml_combined_fragment: 'rectangle',
  uml_interaction_use: 'rectangle',
  uml_note: 'document',
  // Cloud
  cloud: 'cloud',
  database: 'database',
  server: 'server',
  bucket: 'circle',
  queue: 'rectangle',
  // Network
  router: 'router',
  switch: 'rectangle',
  firewall: 'rectangle',
  client: 'server',
  mobile_device: 'rectangle',
  // DFD
  process_dfd: 'circle',
  entity_dfd: 'rectangle',
  datastore_dfd: 'rectangle',
  // C4
  person_c4: 'circle',
  system_c4: 'rectangle',
  container_c4: 'rectangle',
  component_c4: 'rectangle',
  // BPMN
  bpmn_event: 'bpmnEvent',
  bpmn_task: 'bpmnTask',
  bpmn_gateway: 'bpmnGateway',
  bpmn_subprocess: 'bpmnTask',
  bpmn_data_object: 'document',
  // Extended basic shapes
  hexagon: 'hexagon',
  pentagon: 'pentagon',
  star: 'star',
  trapezoid: 'trapezoid',
  cross: 'cross',
  cylinder_basic: 'cylinder',
  oval_basic: 'oval',
  double_rectangle: 'double_rectangle',
  lozenge: 'lozenge',
  chevron: 'chevron',
  delay: 'delay',
  right_angle: 'right_angle',
  rounded_rect_basic: 'rounded_rect_basic',
};

export function getSvgIcon(shapeId: string): string {
  const iconKey = iconMap[shapeId];
  if (iconKey && SvgIcons[iconKey]) {
    const iconFn = SvgIcons[iconKey];
    return iconFn();
  }
  return SvgIcons.rectangle();
}
