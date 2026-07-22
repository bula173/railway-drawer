/**
 * BPMN (Business Process Model and Notation) shapes registry
 */

import { shapeRegistry } from '../registry';

export function registerBpmnShapes(): void {
  shapeRegistry.register({
    id: 'bpmn_event',
    type: 'vertex',
    label: 'Event',
    icon: '●',
    group: 'BPMN',
    width: 60,
    height: 60,
    style: { shape: 'customBpmnEvent', fillColor: '#fff2cc', strokeColor: '#d6b656' },
  });

  shapeRegistry.register({
    id: 'bpmn_task',
    type: 'vertex',
    label: 'Task',
    icon: '▬',
    group: 'BPMN',
    width: 120,
    height: 80,
    style: { shape: 'customBpmnTask', fillColor: '#b3e5fc', strokeColor: '#0288d1' },
  });

  shapeRegistry.register({
    id: 'bpmn_gateway',
    type: 'vertex',
    label: 'Gateway',
    icon: '◇',
    group: 'BPMN',
    width: 80,
    height: 80,
    style: { shape: 'customBpmnGateway', fillColor: '#f8b88b', strokeColor: '#e67e22' },
  });

  shapeRegistry.register({
    id: 'bpmn_subprocess',
    type: 'vertex',
    label: 'Subprocess',
    icon: '⬚',
    group: 'BPMN',
    width: 140,
    height: 100,
    style: { shape: 'customBpmnTask', fillColor: '#d4e6f1', strokeColor: '#3498db', dashed: true },
  });

  shapeRegistry.register({
    id: 'bpmn_data_object',
    type: 'vertex',
    label: 'Data Object',
    icon: '📄',
    group: 'BPMN',
    width: 80,
    height: 100,
    style: { fillColor: '#e2efda', strokeColor: '#70ad47' },
  });
}
