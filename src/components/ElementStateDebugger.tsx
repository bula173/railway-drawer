import React, { useRef } from 'react';
import DrawArea, { type DrawAreaRef } from './DrawArea';
import type { DrawElement } from './Elements';

/**
 * Debugging component to isolate element state management issues
 */
const ElementStateDebugger: React.FC = () => {
  const drawAreaRef = useRef<DrawAreaRef>(null);

  const createTestElement = (): DrawElement => ({
    id: `debug-element-${Date.now()}`,
    name: 'Debug Element',
    type: 'custom',
    start: { x: 100, y: 100 },
    end: { x: 200, y: 200 },
    gridEnabled: true,
    backgroundColor: '#ffffff',
    setGridEnabled: () => {},
    setBackgroundColor: () => {},
    shape: '<rect width="100" height="100" fill="blue" stroke="black" stroke-width="2"/>',
    width: 100,
    height: 100,
    rotation: 0,
  });

  const addTestElement = () => {
    console.log('🔧 DEBUG: Adding test element');
    const element = createTestElement();
    console.log('🔧 DEBUG: Created element:', element);
    
    if (drawAreaRef.current) {
      const currentElements = drawAreaRef.current.getElements();
      console.log('🔧 DEBUG: Current elements before add:', currentElements.length);
      
      drawAreaRef.current.setElements([...currentElements, element]);
      
      setTimeout(() => {
        const newElements = drawAreaRef.current?.getElements();
        console.log('🔧 DEBUG: Elements after add:', newElements?.length);
        console.log('🔧 DEBUG: Added element details:', newElements?.find(el => el.id === element.id));
      }, 100);
    }
  };

  const updateFirstElementStyle = () => {
    console.log('🔧 DEBUG: Updating first element style');
    
    if (drawAreaRef.current) {
      const elements = drawAreaRef.current.getElements();
      console.log('🔧 DEBUG: Current elements before update:', elements.length);
      
      if (elements.length > 0) {
        const firstElement = elements[0];
        console.log('🔧 DEBUG: Updating element:', firstElement.id);
        
        const updatedElement = {
          ...firstElement,
          styles: {
            fill: '#ff0000',
            opacity: 0.5,
            stroke: '#00ff00',
            strokeWidth: 3,
          }
        };
        
        console.log('🔧 DEBUG: Updated element:', updatedElement);
        
        const updatedElements = elements.map(el => 
          el.id === firstElement.id ? updatedElement : el
        );
        
        console.log('🔧 DEBUG: Setting updated elements array:', updatedElements.length);
        drawAreaRef.current.setElements(updatedElements);
        
        setTimeout(() => {
          const finalElements = drawAreaRef.current?.getElements();
          console.log('🔧 DEBUG: Elements after style update:', finalElements?.length);
          const updatedEl = finalElements?.find(el => el.id === firstElement.id);
          console.log('🔧 DEBUG: Updated element found:', !!updatedEl);
          console.log('🔧 DEBUG: Updated element styles:', updatedEl?.styles);
        }, 100);
      } else {
        console.log('🔧 DEBUG: No elements to update');
      }
    }
  };

  const logCurrentState = () => {
    console.log('🔧 DEBUG: ===== CURRENT STATE =====');
    if (drawAreaRef.current) {
      const elements = drawAreaRef.current.getElements();
      console.log('🔧 DEBUG: Element count:', elements.length);
      elements.forEach((el, index) => {
        console.log(`🔧 DEBUG: Element ${index}:`, {
          id: el.id,
          name: el.name,
          type: el.type,
          hasStyles: !!el.styles,
          styles: el.styles,
          hasShape: !!el.shape,
        });
      });
    } else {
      console.log('🔧 DEBUG: No drawAreaRef available');
    }
    console.log('🔧 DEBUG: ========================');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ padding: '10px', backgroundColor: '#f0f0f0', borderBottom: '1px solid #ccc' }}>
        <h2>Element State Debugger</h2>
        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={addTestElement} style={{ padding: '8px 16px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px' }}>
            Add Test Element
          </button>
          <button onClick={updateFirstElementStyle} style={{ padding: '8px 16px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '4px' }}>
            Update First Element Style
          </button>
          <button onClick={logCurrentState} style={{ padding: '8px 16px', backgroundColor: '#6c757d', color: 'white', border: 'none', borderRadius: '4px' }}>
            Log Current State
          </button>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <DrawArea
          ref={drawAreaRef}
          GRID_WIDTH={800}
          GRID_HEIGHT={600}
          GRID_SIZE={20}
          zoom={1}
        />
      </div>
    </div>
  );
};

export default ElementStateDebugger;
