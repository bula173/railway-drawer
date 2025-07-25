/**
 * @file Elements.tsx
 * @brief React components and utilities for rendering, editing, and manipulating drawable elements in the railway-drawer app.
 *
 * This file contains:
 * - The DrawElement type definition.
 * - The ElementSVG component for rendering SVG shapes.
 * - The RenderElement component for interactive editing, resizing, rotating, and labeling.
 * - Utility functions for bounding box calculation and mirroring elements.
 *
 * @author
 * @date
 */

import React, { useRef } from "react";
import { RotateCw } from "lucide-react";
import "../styles/elements.css";
// --- Types ---

/**
 * @interface ElementStyles
 * @brief Represents styling properties for drawable elements.
 */
export interface ElementStyles {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  opacity?: number;
  strokeOpacity?: number;
  fillOpacity?: number;
}

/**
 * @function getElementStyleProps
 * @brief Converts ElementStyles to SVG style props
 * @param styles The element styles
 * @returns SVG style props object
 */
export function getElementStyleProps(styles?: ElementStyles): Record<string, any> {
  if (!styles) return {};
  
  const styleProps: Record<string, any> = {};
  if (styles.fill !== undefined) styleProps.fill = styles.fill;
  if (styles.stroke !== undefined) styleProps.stroke = styles.stroke;
  if (styles.strokeWidth !== undefined) styleProps.strokeWidth = styles.strokeWidth;
  if (styles.strokeDasharray !== undefined) styleProps.strokeDasharray = styles.strokeDasharray;
  if (styles.opacity !== undefined) styleProps.opacity = styles.opacity;
  if (styles.strokeOpacity !== undefined) styleProps.strokeOpacity = styles.strokeOpacity;
  if (styles.fillOpacity !== undefined) styleProps.fillOpacity = styles.fillOpacity;
  
  return styleProps;
}

/**
 * @function applyStylesToSVGString
 * @brief Applies styles to SVG string content
 * @param svgContent The SVG content as string
 * @param styles The styles to apply
 * @returns Modified SVG content
 */
export function applyStylesToSVGString(svgContent: string, styles?: ElementStyles): string {
  // Check if SVG content is valid
  if (!svgContent || svgContent.trim() === '') {
    console.error("❌ EMPTY SVG CONTENT passed to applyStylesToSVGString!");
    return svgContent;
  }
  
  // If no styles to apply, return original content
  if (!styles) {
    return svgContent;
  }
  
  try {
    // Parse the SVG content using DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<svg>${svgContent}</svg>`, 'image/svg+xml');
    
    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.error("❌ SVG parsing error:", parserError.textContent);
      return svgContent;
    }
    
    // Get all drawable SVG elements
    const drawableElements = doc.querySelectorAll('rect, circle, ellipse, line, polyline, polygon, path, text');
    
    // Apply styles to each drawable element
    drawableElements.forEach(element => {
      if (styles.fill !== undefined) {
        element.setAttribute('fill', styles.fill);
      }
      if (styles.stroke !== undefined) {
        element.setAttribute('stroke', styles.stroke);
      }
      if (styles.strokeWidth !== undefined) {
        element.setAttribute('stroke-width', styles.strokeWidth.toString());
      }
      if (styles.strokeDasharray !== undefined) {
        element.setAttribute('stroke-dasharray', styles.strokeDasharray);
      }
      if (styles.opacity !== undefined) {
        element.setAttribute('opacity', styles.opacity.toString());
      }
      if (styles.strokeOpacity !== undefined) {
        element.setAttribute('stroke-opacity', styles.strokeOpacity.toString());
      }
      if (styles.fillOpacity !== undefined) {
        element.setAttribute('fill-opacity', styles.fillOpacity.toString());
      }
    });
    
    // Extract the modified content (everything inside the wrapper <svg> tag)
    const svgElement = doc.querySelector('svg');
    if (!svgElement) {
      console.error("❌ No SVG element found after parsing");
      return svgContent;
    }
    
    const modifiedContent = svgElement.innerHTML;
    
    return modifiedContent;
    
  } catch (error) {
    console.error("❌ Error applying styles to SVG:", error);
    return svgContent; // Fallback to original content on error
  }
}

/**
 * @interface ShapeElement
 * @brief Represents a single shape element with optional text regions.
 */
export interface ShapeElement {
  id: string;
  svg: string; // Direct SVG content
  textRegions?: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
  }[];
}

/**
 * @interface DrawElement
 * @brief Represents a drawable element with geometry, style, and metadata.
 */
export interface DrawElement {
  // Core properties
  id: string;
  name?: string;
  type: string;
  
  // Styling properties
  styles?: ElementStyles;
  
  // Toolbox properties
  iconSvg?: string;
  iconName?: string;
  iconSource?: string;
  shape?: string;
  shapeElements?: ShapeElement[]; // Array of shape element definitions
  width?: number;
  height?: number;
  draw?: any;
  
  // Element geometry
  start: { x: number; y: number };
  end: { x: number; y: number };
  labelOffset?: { dx: number; dy: number };
  rotation?: number;
  
  // Content properties
  text?: string;
  
  // Global properties (for draw area)
  gridEnabled?: boolean;
  backgroundColor?: string;
  setGridEnabled?: (enabled: boolean) => void;
  setBackgroundColor?: (color: string) => void;
  
  // Mirror properties
  mirrorX?: boolean;
  mirrorY?: boolean;
  
  // Allow additional properties
  [key: string]: any;
}

/**
 * @function ElementSVG
 * @brief Renders the SVG for a given DrawElement.
 * @param el The element to render.
 * @returns JSX.Element
 */
export const ElementSVG: React.FC<{ el: DrawElement }> = ({ el }) => {

  switch (el.type) {
   
    case "custom":
      if (el.shape || el.shapeElements) {
        // Use fallback size if missing or zero
        const shapeWidth = el.width && el.width > 0 ? el.width : 48;
        const shapeHeight = el.height && el.height > 0 ? el.height : 48;

        const width = Math.abs(el.end.x - el.start.x);
        const height = Math.abs(el.end.y - el.start.y);

        // Prevent division by zero
        const scaleX = shapeWidth ? width / shapeWidth : 1;
        const scaleY = shapeHeight ? height / shapeHeight : 1;

        const mirrorScaleX = el.mirrorX ? -1 : 1;
        const mirrorScaleY = el.mirrorY ? -1 : 1;
        const mirrorTranslateX = el.mirrorX ? shapeWidth : 0;
        const mirrorTranslateY = el.mirrorY ? shapeHeight : 0;

        // Determine the shape to render
        let shapeToRender = '';
        
        // Priority: dynamic UML class > shapeElements > shape
        if (el.id === "uml_class" && el.shapeElements) {
          // Check if UML class has enough textRegions across all shapeElements
          const allTextRegions = calculateAdjustedTextRegions(el);
          if (allTextRegions.length >= 3) {
            const dynamicUML = generateDynamicUMLClassSVG(el);
            if (dynamicUML.shape) {
              shapeToRender = dynamicUML.shape;
            }
          }
        } else if (el.shapeElements && el.shapeElements.length > 0) {
          // Generate SVG from shape elements (only if there are elements)
          shapeToRender = generateSVGFromElements(el.shapeElements);
        } else if (el.shape) {
          // Use legacy shape property
          let rawShape = el.shape;
          // Remove outer <svg> wrapper if present
          if (rawShape.includes('<svg>') && rawShape.includes('</svg>')) {
            rawShape = rawShape.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '');
          }
          shapeToRender = rawShape;
        }

        // Check if we have any content to render
        if (!shapeToRender || shapeToRender.trim() === '') {
          console.warn("Custom SVG element has no SVG content or shape elements:", el.id);
          return null;
        }

        // Apply styles to the SVG content
        const styledShape = applyStylesToSVGString(shapeToRender, el.styles);
        
        // Validate the styled shape before rendering
        if (!styledShape || styledShape.trim() === '') {
          console.error("❌ Empty or null styled shape for element:", el.id, "falling back to original");
          return (
            <g
              transform={`
        translate(${el.start.x},${el.start.y})
        scale(${scaleX},${scaleY})
        translate(${mirrorTranslateX},${mirrorTranslateY})
        scale(${mirrorScaleX},${mirrorScaleY})
      `}
            >
              <g dangerouslySetInnerHTML={{ __html: shapeToRender }} />
            </g>
          );
        }

        return (
          <g
            transform={`
      translate(${el.start.x},${el.start.y})
      scale(${scaleX},${scaleY})
      translate(${mirrorTranslateX},${mirrorTranslateY})
      scale(${mirrorScaleX},${mirrorScaleY})
    `}
          >
            <g dangerouslySetInnerHTML={{ __html: styledShape }} />
          </g>
        );
      }
      break;
      
    case "text": {
      const textCx = (el.start.x + el.end.x) / 2;
      const textCy = (el.start.y + el.end.y) / 2;
      return (
        <text 
          x={textCx} 
          y={textCy} 
          fontSize={18} 
          textAnchor="middle" 
          dominantBaseline="middle"
          {...getElementStyleProps(el.styles)}
        >
          {"Text"}
        </text>
      );
    }
    default:
      return null;
  }
};

/**
 * @function getElementBoundingRect
 * @brief Calculates the bounding rectangle for a DrawElement.
 * @param el The element to calculate for.
 * @returns An object with x, y, width, and height.
 */
export function getElementBoundingRect(el: DrawElement) {
  const x = Math.min(el.start.x, el.end.x);
  const y = Math.min(el.start.y, el.end.y);
  const width = Math.abs(el.end.x - el.start.x);
  const height = Math.abs(el.end.y - el.start.y);
  
  // Start with the basic element bounds
  let minX = x;
  let minY = y;
  let maxX = x + width;
  let maxY = y + height;
  
  // For custom elements, check if the shape extends beyond the defined bounds
  if (el.type === "custom" && el.shape) {
    // Parse SVG content to find actual bounds
    const parser = new DOMParser();
    const svgContent = `<svg>${el.shape}</svg>`;
    const svgDoc = parser.parseFromString(svgContent, "image/svg+xml");
    const svgElement = svgDoc.querySelector("svg");
    
    if (svgElement) {
      // Get all elements and calculate their bounds
      const elements = svgElement.querySelectorAll("*");
      let shapeMinX = Infinity, shapeMinY = Infinity, shapeMaxX = -Infinity, shapeMaxY = -Infinity;
      
      elements.forEach(elem => {
        const tagName = elem.tagName.toLowerCase();
        
        // Extract coordinates based on element type
        let elemBounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };
        
        switch (tagName) {
          case "rect": {
            const rectX = parseFloat(elem.getAttribute("x") || "0");
            const rectY = parseFloat(elem.getAttribute("y") || "0");
            const rectW = parseFloat(elem.getAttribute("width") || "0");
            const rectH = parseFloat(elem.getAttribute("height") || "0");
            elemBounds = { minX: rectX, minY: rectY, maxX: rectX + rectW, maxY: rectY + rectH };
            break;
          }
            
          case "circle": {
            const cx = parseFloat(elem.getAttribute("cx") || "0");
            const cy = parseFloat(elem.getAttribute("cy") || "0");
            const r = parseFloat(elem.getAttribute("r") || "0");
            elemBounds = { minX: cx - r, minY: cy - r, maxX: cx + r, maxY: cy + r };
            break;
          }
            
          case "line": {
            const x1 = parseFloat(elem.getAttribute("x1") || "0");
            const y1 = parseFloat(elem.getAttribute("y1") || "0");
            const x2 = parseFloat(elem.getAttribute("x2") || "0");
            const y2 = parseFloat(elem.getAttribute("y2") || "0");
            elemBounds = { minX: Math.min(x1, x2), minY: Math.min(y1, y2), maxX: Math.max(x1, x2), maxY: Math.max(y1, y2) };
            break;
          }
            
          case "polygon": {
            const points = elem.getAttribute("points") || "";
            const coords = points.split(/[\s,]+/).filter(p => p).map(parseFloat);
            if (coords.length >= 2) {
              const xs = coords.filter((_, i) => i % 2 === 0);
              const ys = coords.filter((_, i) => i % 2 === 1);
              elemBounds = { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
            }
            break;
          }
            
          case "ellipse": {
            const ecx = parseFloat(elem.getAttribute("cx") || "0");
            const ecy = parseFloat(elem.getAttribute("cy") || "0");
            const erx = parseFloat(elem.getAttribute("rx") || "0");
            const ery = parseFloat(elem.getAttribute("ry") || "0");
            elemBounds = { minX: ecx - erx, minY: ecy - ery, maxX: ecx + erx, maxY: ecy + ery };
            break;
          }
        }
        
        shapeMinX = Math.min(shapeMinX, elemBounds.minX);
        shapeMinY = Math.min(shapeMinY, elemBounds.minY);
        shapeMaxX = Math.max(shapeMaxX, elemBounds.maxX);
        shapeMaxY = Math.max(shapeMaxY, elemBounds.maxY);
      });
      
      // If we found actual bounds, use them to adjust the bounding rect
      if (shapeMinX !== Infinity && shapeMaxX !== -Infinity) {
        const originalWidth = el.width || 48;
        const originalHeight = el.height || 48;
        const actualWidth = shapeMaxX - shapeMinX;
        const actualHeight = shapeMaxY - shapeMinY;
        
        // Calculate scale factors
        const scaleX = width / originalWidth;
        const scaleY = height / originalHeight;
        
        // Apply scale to actual bounds
        const scaledActualWidth = actualWidth * scaleX;
        const scaledActualHeight = actualHeight * scaleY;
        const scaledMinX = shapeMinX * scaleX;
        const scaledMinY = shapeMinY * scaleY;
        
        // Update bounds to include scaled shape content
        minX = Math.min(minX, x + scaledMinX);
        minY = Math.min(minY, y + scaledMinY);
        maxX = Math.max(maxX, x + scaledMinX + scaledActualWidth);
        maxY = Math.max(maxY, y + scaledMinY + scaledActualHeight);
      }
    }
  }
  
  // Check if element has text regions that might extend beyond current bounds
  const allTextRegions = el.shapeElements ? collectTextRegionsFromShapeElements(el.shapeElements) : [];
    
  if (allTextRegions.length > 0) {
    const adjustedRegions = calculateAdjustedTextRegions(el);
    
    adjustedRegions.forEach((adjustedRegion: any) => {
      // Center the text within the region and calculate actual bounds
      let textLeft = adjustedRegion.scaledX;
      let textRight = adjustedRegion.scaledX + adjustedRegion.effectiveWidth;
      const textTop = adjustedRegion.scaledY;
      const textBottom = adjustedRegion.scaledY + adjustedRegion.effectiveHeight;
      
      // Adjust for text alignment
      if (adjustedRegion.align === 'center') {
        const centerX = adjustedRegion.scaledX + adjustedRegion.scaledWidth / 2;
        textLeft = centerX - adjustedRegion.effectiveWidth / 2;
        textRight = centerX + adjustedRegion.effectiveWidth / 2;
      } else if (adjustedRegion.align === 'right') {
        textLeft = adjustedRegion.scaledX + adjustedRegion.scaledWidth - adjustedRegion.effectiveWidth;
        textRight = adjustedRegion.scaledX + adjustedRegion.scaledWidth;
      }
      
      // Expand element bounds to include text region
      minX = Math.min(minX, textLeft);
      minY = Math.min(minY, textTop);
      maxX = Math.max(maxX, textRight);
      maxY = Math.max(maxY, textBottom);
    });
  }
  
  return { 
    x: minX, 
    y: minY, 
    width: maxX - minX, 
    height: maxY - minY 
  };
}

/**
 * @function calculateAdjustedTextRegions
 * @brief Calculates adjusted positions for text regions to prevent overlap when text overflows.
 * @param el The element containing text regions.
 * @returns Array of adjusted region data with positions and dimensions.
 */
export function calculateAdjustedTextRegions(el: DrawElement): any[] {
  // Collect textRegions from shapeElements (standardized approach)
  let textRegions: any[] = [];
  
  if (el.shapeElements) {
    const shapeElementRegions = collectTextRegionsFromShapeElements(el.shapeElements);
    textRegions = shapeElementRegions || [];
  }
  
  if (textRegions.length === 0) return [];
  
  // Special handling for UML class elements
  if (el.id === "uml_class" && textRegions.length >= 3) {
    const dynamicUML = generateDynamicUMLClassSVG(el);
    if (dynamicUML.textRegions) {
      // Use the dynamically calculated text regions
      const width = Math.abs(el.end.x - el.start.x);
      const height = Math.abs(el.end.y - el.start.y);
      const originalWidth = el.width || 120;
      const originalHeight = el.height || 80;
      const scaleX = width / originalWidth;
      const scaleY = height / originalHeight;
      
      return dynamicUML.textRegions.map((region: any, index: number) => {
        const scaledX = el.start.x + (region.x * scaleX);
        const scaledY = el.start.y + (region.y * scaleY);
        const scaledWidth = region.width * scaleX;
        const scaledHeight = region.height * scaleY;
        const fontSize = (region.fontSize || 12) * Math.min(scaleX, scaleY);
        const lines = (region.text || '').split('\n');
        
        return {
          ...region,
          index,
          scaledX,
          scaledY,
          scaledWidth,
          scaledHeight,
          effectiveWidth: scaledWidth,
          effectiveHeight: scaledHeight,
          fontSize,
          lines
        };
      });
    }
  }
  
  const shapeWidth = el.width && el.width > 0 ? el.width : 48;
  const shapeHeight = el.height && el.height > 0 ? el.height : 48;
  const width = Math.abs(el.end.x - el.start.x);
  const height = Math.abs(el.end.y - el.start.y);
  const scaleX = shapeWidth ? width / shapeWidth : 1;
  const scaleY = shapeHeight ? height / shapeHeight : 1;
  
  let cumulativeYOffset = 0;
  
  return textRegions.map((region, index) => {
    // Calculate scaled text region bounds with cumulative offset
    const scaledX = el.start.x + (region.x * scaleX);
    const originalScaledY = el.start.y + (region.y * scaleY);
    const adjustedScaledY = originalScaledY + cumulativeYOffset;
    const scaledWidth = region.width * scaleX;
    const scaledHeight = region.height * scaleY;
    
    // Estimate text bounds based on content
    const fontSize = (region.fontSize || 12) * Math.min(scaleX, scaleY);
    const lines = (region.text || '').split('\n');
    const maxLineLength = Math.max(...lines.map((line: string) => line.length));
    
    // Rough text width estimation (chars * fontSize * 0.6)
    const estimatedTextWidth = maxLineLength * fontSize * 0.6;
    const estimatedTextHeight = lines.length * fontSize * 1.2; // Line height factor
    
    // Expand region bounds if text is larger than region
    const effectiveWidth = Math.max(scaledWidth, estimatedTextWidth);
    const effectiveHeight = Math.max(scaledHeight, estimatedTextHeight);
    
    // Calculate overflow from this region to adjust subsequent regions
    const textOverflow = Math.max(0, effectiveHeight - scaledHeight);
    cumulativeYOffset += textOverflow;
    
    return {
      ...region,
      index,
      scaledX,
      scaledY: adjustedScaledY,
      scaledWidth,
      scaledHeight,
      effectiveWidth,
      effectiveHeight,
      fontSize,
      lines
    };
  });
}

/**
 * @function getRotatedBoundingRect
 * @brief Calculates the rotated bounding rectangle for a DrawElement.
 * @param el The element to calculate for.
 * @returns An object with corner points of the rotated rectangle.
 */
export function getRotatedBoundingRect(el: DrawElement) {
  const rect = getElementBoundingRect(el);
  
  if (!el.rotation) {
    // No rotation, return corners of axis-aligned rectangle
    return {
      topLeft: { x: rect.x, y: rect.y },
      topRight: { x: rect.x + rect.width, y: rect.y },
      bottomLeft: { x: rect.x, y: rect.y + rect.height },
      bottomRight: { x: rect.x + rect.width, y: rect.y + rect.height },
      center: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
    };
  }
  
  // Calculate rotation center
  const centerX = (el.start.x + el.end.x) / 2;
  const centerY = (el.start.y + el.end.y) / 2;
  const rotation = (el.rotation * Math.PI) / 180; // Convert to radians
  
  // Original corners relative to center
  const corners = [
    { x: rect.x - centerX, y: rect.y - centerY }, // top-left
    { x: rect.x + rect.width - centerX, y: rect.y - centerY }, // top-right
    { x: rect.x - centerX, y: rect.y + rect.height - centerY }, // bottom-left
    { x: rect.x + rect.width - centerX, y: rect.y + rect.height - centerY } // bottom-right
  ];
  
  // Rotate corners around center
  const rotatedCorners = corners.map(corner => ({
    x: centerX + corner.x * Math.cos(rotation) - corner.y * Math.sin(rotation),
    y: centerY + corner.x * Math.sin(rotation) + corner.y * Math.cos(rotation)
  }));
  
  return {
    topLeft: rotatedCorners[0],
    topRight: rotatedCorners[1],
    bottomLeft: rotatedCorners[2],
    bottomRight: rotatedCorners[3],
    center: { x: centerX, y: centerY }
  };
}

/**
 * @function generateSVGFromElements
 * @brief Generates SVG content from an array of shape elements.
 * @param shapeElements Array of element definitions
 * @returns SVG content as string
 */
export function generateSVGFromElements(shapeElements: ShapeElement[]): string {
  if (!shapeElements || shapeElements.length === 0) {
    return '';
  }
  
  // Create a copy to avoid any potential mutation
  const elementsCopy = [...shapeElements];
  
  const result = elementsCopy.map((element) => {
    // Simply return the SVG content directly
    return element.svg;
  }).join('');
  
  return result;
}

/**
 * @function generateDynamicUMLClassSVG
 * @brief Generates a UML class SVG with sections sized according to text content.
 * @param el The UML class element
 * @returns Object containing the SVG shape and adjusted text regions
 */
export function generateDynamicUMLClassSVG(el: DrawElement): any {
  // Get textRegions from shapeElements using the standardized approach
  const allTextRegions = calculateAdjustedTextRegions(el);
  
  if (!allTextRegions || allTextRegions.length < 3) {
    // Fallback to original shape if no text regions
    return {
      shape: el.shape,
      textRegions: allTextRegions
    };
  }

  const width = Math.abs(el.end.x - el.start.x);
  const height = Math.abs(el.end.y - el.start.y);
  const originalWidth = el.width || 120;
  const originalHeight = el.height || 80;
  const scaleX = width / originalWidth;
  const scaleY = height / originalHeight;
  
  // Calculate required heights for each section based on text content
  const sections = allTextRegions.map((region: any, index: number) => {
    const fontSize = (region.fontSize || 12) * Math.min(scaleX, scaleY);
    const lines = (region.text || '').split('\n');
    const textHeight = lines.length * fontSize * 1.4; // Line height factor
    const padding = 10; // Padding within each section
    const minHeight = fontSize + padding; // Minimum height
    
    return {
      index,
      requiredHeight: Math.max(minHeight, textHeight + padding),
      originalRegion: region
    };
  });

  // Calculate section positions and total height
  let currentY = 0;
  const adjustedSections = sections.map((section: any) => {
    const sectionY = currentY;
    const sectionHeight = section.requiredHeight;
    currentY += sectionHeight;
    
    return {
      ...section,
      y: sectionY,
      height: sectionHeight,
      adjustedRegion: {
        ...section.originalRegion,
        x: 10,
        y: sectionY + 5, // Small padding from top
        width: originalWidth - 20, // 10px padding on each side
        height: sectionHeight - 10, // Account for padding
      }
    };
  });

  const totalHeight = currentY;
  const scaledWidth = originalWidth;

  // Generate dynamic shape elements
  const shapeElements: any[] = [
    {
      type: 'rect',
      id: 'mainRect',
      x: 0,
      y: 0,
      width: scaledWidth,
      height: totalHeight,
      fill: '#fff',
      stroke: '#000',
      strokeWidth: 2,
      vectorEffect: 'non-scaling-stroke'
    }
  ];

  // Add divider lines between sections (but not after the last section)
  for (let i = 0; i < adjustedSections.length - 1; i++) {
    const dividerY = adjustedSections[i].y + adjustedSections[i].height;
    shapeElements.push({
      type: 'line',
      id: `divider${i + 1}`,
      x1: 0,
      y1: dividerY,
      x2: scaledWidth,
      y2: dividerY,
      stroke: '#000',
      strokeWidth: 1,
      vectorEffect: 'non-scaling-stroke'
    });
  }

  // Generate SVG from elements
  const svgShape = generateSVGFromElements(shapeElements);

  return {
    shape: svgShape,
    shapeElements: shapeElements,
    textRegions: adjustedSections.map((section: any) => section.adjustedRegion),
    adjustedHeight: totalHeight
  };
}

/**
 * @function RenderElement
 * @brief Main component for rendering and interacting with a DrawElement.
 * @param props The props for the element, selection, and handlers.
 * @returns JSX.Element
 */
export function RenderElement({
  el,
  isSelected,
  hoveredElementId,
  setHoveredElementId,
  updateElement,
  handlePointerDown,
}: {
  el: DrawElement;
  isSelected: boolean;
  hoveredElementId: string | null;
  setHoveredElementId: (id: string | null) => void;
  updateElement: (el: DrawElement) => void;
  handlePointerDown: (e: React.PointerEvent, el: DrawElement) => void;
}) {
  // --- State ---
  const [labelDragging, setLabelDragging] = React.useState(false);
  const [editingLabel, setEditingLabel] = React.useState(false);
  const [editValue, setEditValue] = React.useState(el.name || "");
  const [labelHovered, setLabelHovered] = React.useState(false);
  const [editingText, setEditingText] = React.useState(false);
  const [editTextValue, setEditTextValue] = React.useState(el.text || "");
  // Text region editing state
  const [editingTextRegion, setEditingTextRegion] = React.useState<number | null>(null);
  const [editRegionValue, setEditRegionValue] = React.useState("");
  // Shape element editing state
  const [editingShapeElement, setEditingShapeElement] = React.useState<string | null>(null);
  const [editShapeElementData, setEditShapeElementData] = React.useState<any>(null);

  // --- Resize Logic ---
  const resizingRef = useRef<{
    handle: string;
    startX: number;
    startY: number;
    startEl: DrawElement;
  } | null>(null);

  /**
   * @function renderResizeHandles
   * @brief Renders resize handles at the corners of the element's bounding rectangle.
   * @param rect The bounding rectangle with x, y, width, and height properties.
   * @returns Array of JSX elements representing resize handles.
   */
  function renderResizeHandles(rect: { x: number, y: number, width: number, height: number }) {
    if (el.rotation) {
      // For rotated elements, use the rotated corner positions
      const rotatedRect = getRotatedBoundingRect(el);
      const handles = [
        { pos: rotatedRect.topLeft, cursor: "nwse-resize", name: "topLeft" },
        { pos: rotatedRect.topRight, cursor: "nesw-resize", name: "topRight" },
        { pos: rotatedRect.bottomLeft, cursor: "nesw-resize", name: "bottomLeft" },
        { pos: rotatedRect.bottomRight, cursor: "nwse-resize", name: "bottomRight" },
      ];
      return handles.map(h => (
        <rect
          key={h.name}
          className={`resize-handle ${h.cursor.replace('-resize', '-resize')}`}
          x={h.pos.x - 6}
          y={h.pos.y - 6}
          onPointerDown={e => handleResizePointerDown(e, h.name)}
        />
      ));
    } else {
      // For non-rotated elements, use the original approach
      const handles = [
        { x: rect.x, y: rect.y, cursor: "nwse-resize", name: "topLeft" },
        { x: rect.x + rect.width, y: rect.y, cursor: "nesw-resize", name: "topRight" },
        { x: rect.x, y: rect.y + rect.height, cursor: "nesw-resize", name: "bottomLeft" },
        { x: rect.x + rect.width, y: rect.y + rect.height, cursor: "nwse-resize", name: "bottomRight" },
      ];
      return handles.map(h => (
        <rect
          key={h.name}
          className={`resize-handle ${h.cursor.replace('-resize', '-resize')}`}
          x={h.x - 6}
          y={h.y - 6}
          onPointerDown={e => handleResizePointerDown(e, h.name)}
        />
      ));
    }
  }

  /**
   * @function handleResizePointerDown
   * @brief Handles the start of a resize operation when a resize handle is clicked.
   * @param e The pointer event from the resize handle.
   * @param handle The name of the resize handle ("topLeft", "topRight", etc.).
   */
  function handleResizePointerDown(e: React.PointerEvent, handle: string) {
    e.stopPropagation();
    console.log("Resize handle down:", handle, "at", e.clientX, e.clientY, "for element", el.id);
    resizingRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      startEl: { ...el },
    };
    window.addEventListener("pointermove", handleResizePointerMove);
    window.addEventListener("pointerup", handleResizePointerUp);
  }

  /**
   * @function handleResizePointerMove
   * @brief Handles mouse movement during a resize operation.
   * @param e The pointer event containing current mouse position.
   * @description Updates element start/end coordinates based on which handle is being dragged.
   * Handles mirroring for custom SVG elements when dimensions become negative.
   */
  function handleResizePointerMove(e: PointerEvent) {
    const resize = resizingRef.current;
    if (!resize) return;

    // Get SVG coordinates
    const svg = (e.target as SVGElement).ownerSVGElement || (e.target as SVGSVGElement);
    if (!svg) return;
    const svgRect = svg.getBoundingClientRect();
    const mouseX = e.clientX - svgRect.left;
    const mouseY = e.clientY - svgRect.top;
    const dx = mouseX - (resize.startX - svgRect.left);
    const dy = mouseY - (resize.startY - svgRect.top);

    let newStart = { ...resize.startEl.start };
    let newEnd = { ...resize.startEl.end };

    switch (resize.handle) {
      case "topLeft":
        newStart = { x: resize.startEl.start.x + dx, y: resize.startEl.start.y + dy };
        break;
      case "topRight":
        newStart = { x: resize.startEl.start.x, y: resize.startEl.start.y + dy };
        newEnd = { x: resize.startEl.end.x + dx, y: resize.startEl.end.y };
        break;
      case "bottomLeft":
        newStart = { x: resize.startEl.start.x + dx, y: resize.startEl.start.y };
        newEnd = { x: resize.startEl.end.x, y: resize.startEl.end.y + dy };
        break;
      case "bottomRight":
        newEnd = { x: resize.startEl.end.x + dx, y: resize.startEl.end.y + dy };
        break;
    }

    console.log("Resizing", resize.handle, "to", { newStart, newEnd }, "for element", el.id);

    if (Math.abs(newEnd.x - newStart.x) < 8 || Math.abs(newEnd.y - newStart.y) < 8) return;

    let width = newEnd.x - newStart.x;
    let height = newEnd.y - newStart.y;

    let mirrorX = el.mirrorX || false;
    let mirrorY = el.mirrorY || false;

    // Detect mirroring for custom SVGs
    if (el.type === "custom") {
      if (width < 0) {
        mirrorX = !mirrorX;
        [newStart.x, newEnd.x] = [newEnd.x, newStart.x];
        width = -width;
      }
      if (height < 0) {
        mirrorY = !mirrorY;
        [newStart.y, newEnd.y] = [newEnd.y, newStart.y];
        height = -height;
      }
      updateElement({ ...el, start: newStart, end: newEnd, mirrorX, mirrorY });
    } else {
      // For non-custom, allow negative width/height (mirroring by coordinates)
      updateElement({ ...el, start: newStart, end: newEnd });
    }
  }

  /**
   * @function handleResizePointerUp
   * @brief Cleans up resize operation when mouse is released.
   * @description Removes event listeners and clears the resizing reference.
   */
  function handleResizePointerUp() {
    console.log("Resize handle up for element", el.id);
    resizingRef.current = null;
    window.removeEventListener("pointermove", handleResizePointerMove);
    window.removeEventListener("pointerup", handleResizePointerUp);
  }

  // --- Helper Functions ---
  
  /**
   * @function renderSelectionHighlight
   * @brief Renders a blue outline around the element when hovered or selected.
   * @returns JSX element for the selection highlight or null if not shown.
   * @description Shows different colors for selected vs hovered states. Handles rotation correctly.
   */
  function renderSelectionHighlight() {
    const shouldShow = hoveredElementId === el.id || isSelected || labelHovered;
    
    if (!shouldShow) return null;
    
    if (el.rotation) {
      // For rotated elements, use a polygon to show proper rotated outline
      const rotatedRect = getRotatedBoundingRect(el);
      const padding = 4;
      
      // Calculate padded corners (expand outward from center)
      const center = rotatedRect.center;
      const corners = [
        rotatedRect.topLeft,
        rotatedRect.topRight, 
        rotatedRect.bottomRight,
        rotatedRect.bottomLeft
      ];
      
      // Expand each corner outward from center by padding amount
      const paddedCorners = corners.map(corner => {
        const dx = corner.x - center.x;
        const dy = corner.y - center.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        if (length === 0) return corner;
        const scale = (length + padding) / length;
        return {
          x: center.x + dx * scale,
          y: center.y + dy * scale
        };
      });
      
      const points = paddedCorners.map(p => `${p.x},${p.y}`).join(' ');
      
      return (
        <polygon
          className={`element-selection-highlight ${isSelected ? 'selected' : 'hovered'}`}
          points={points}
        />
      );
    } else {
      // For non-rotated elements, use the original rect approach
      const rect = getElementBoundingRect(el);
      return (
        <rect
          className={`element-selection-highlight ${isSelected ? 'selected' : 'hovered'}`}
          x={rect.x - 4}
          y={rect.y - 4}
          width={rect.width + 8}
          height={rect.height + 8}
        />
      );
    }
  }

  /**
   * @function renderRotationHandle
   * @brief Renders a rotation button for selected elements.
   * @returns JSX element for the rotation handle or null if element is not selected.
   * @description Positioned at the top-right of the element's bounding box, accounting for rotation.
   */
  function renderRotationHandle() {
    if (!isSelected) return null;
    
    let handlePosition;
    
    if (el.rotation) {
      // For rotated elements, position handle at a fixed offset from the center
      // This ensures it's always accessible regardless of rotation
      const centerX = (el.start.x + el.end.x) / 2;
      const centerY = (el.start.y + el.end.y) / 2;
      
      // Position handle at a fixed distance from center, slightly outside the element
      const rect = getElementBoundingRect(el);
      const maxDimension = Math.max(rect.width, rect.height);
      const handleDistance = maxDimension / 2 + 30; // 30px outside the element
      
      handlePosition = {
        x: centerX + handleDistance,
        y: centerY - 24
      };
    } else {
      // For non-rotated elements, use the original positioning
      const rect = getElementBoundingRect(el);
      handlePosition = {
        x: rect.x + rect.width + 10,
        y: rect.y - 24
      };
    }
    
    return (
      <g
        className="rotation-handle-container"
        onPointerDown={e => {
          e.stopPropagation();
          const current = el.rotation || 0;
          const next = (current + 15) % 360;
          updateElement({ ...el, rotation: next });
        }}
        transform={`translate(${handlePosition.x}, ${handlePosition.y})`}
      >
        {/* Larger invisible clickable area */}
        <rect 
          x={-4} 
          y={-4} 
          width={32} 
          height={32} 
          fill="transparent" 
          style={{ cursor: "pointer" }}
        />
        <rect className="rotation-handle-bg" />
        <RotateCw x={4} y={4} size={16} color="#1976d2" />
        {/* Show current rotation angle */}
        <text 
          x={30} 
          y={16} 
          fontSize={10} 
          fill="#1976d2" 
          textAnchor="start"
        >
          {Math.round(el.rotation || 0)}°
        </text>
      </g>
    );
  }

  /**
   * @function renderElementContent
   * @brief Renders the main SVG content of the element with optional rotation.
   * @returns JSX element containing the ElementSVG component.
   * @description Applies rotation transform around the element's center if rotation is set.
   */
  function renderElementContent() {
    const transform = el.rotation
      ? `rotate(${el.rotation}, ${(el.start.x + el.end.x) / 2}, ${(el.start.y + el.end.y) / 2})`
      : undefined;
    
    return (
      <g transform={transform}>
        <ElementSVG el={el} />
      </g>
    );
  }

  /**
   * @function renderLabelBackground
   * @brief Renders a white background rectangle behind element labels.
   * @returns JSX element for the label background or null if not shown.
   * @description Only shown for non-text elements with names when hovered or selected.
   */
  function renderLabelBackground() {
    const shouldShow = el.type !== "text" && el.name && !editingLabel && 
                      (labelHovered || isSelected || hoveredElementId === el.id);
    
    if (!shouldShow) return null;
    
    const labelX = (el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0);
    const labelY = (el.start.y) + (el.labelOffset?.dy || -30);
    const paddingX = 8;
    const paddingY = 4;
    const fontSize = 14;
    const text = el.name || "";
    const textWidth = text.length * fontSize * 0.6;
    const textHeight = fontSize + 2;
    
    return (
      <rect
        className="element-label-background"
        x={labelX - textWidth / 2 - paddingX}
        y={labelY - textHeight / 2 - paddingY}
        width={textWidth + paddingX * 2}
        height={textHeight + paddingY * 2}
      />
    );
  }

  /**
   * @function handleLabelDrag
   * @brief Handles dragging of element labels to reposition them.
   * @param e The pointer event from the label text element.
   * @description Sets up move and up event listeners to track label position changes.
   */
  function handleLabelDrag(e: React.PointerEvent) {
    e.stopPropagation();
    setLabelDragging(true);
    const svg = (e.target as SVGElement).ownerSVGElement;
    if (!svg) return;
    
    const startX = e.clientX;
    const startY = e.clientY;
    const startDx = el.labelOffset?.dx || -30;
    const startDy = el.labelOffset?.dy || -30;

    function onMove(ev: PointerEvent) {
      const dx = startDx + (ev.clientX - startX);
      const dy = startDy + (ev.clientY - startY);
      updateElement({ ...el, labelOffset: { dx, dy } });
    }
    
    function onUp() {
      setLabelDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }
    
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  /**
   * @function handleLabelDoubleClick
   * @brief Handles double-click on labels to enter edit mode.
   * @param e The mouse event from the label text element.
   */
  function handleLabelDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingLabel(true);
    setEditValue(el.name || "");
  }

  /**
   * @function renderLabel
   * @brief Renders the label text for non-text elements.
   * @returns JSX element for the label text or null if not applicable.
   * @description Supports dragging and double-click editing. Only shown for elements with names.
   */
  function renderLabel() {
    if (el.type === "text" || !el.name || editingLabel) return null;
    
    return (
      <text
        className="element-label"
        x={(el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0)}
        y={(el.start.y) + (el.labelOffset?.dy || -30)}
        onPointerDown={handleLabelDrag}
        onDoubleClick={handleLabelDoubleClick}
        onPointerEnter={() => setLabelHovered(true)}
        onPointerLeave={() => setLabelHovered(false)}
      >
        {el.name}
      </text>
    );
  }

  /**
   * @function handleLabelEdit
   * @brief Updates the element's name and exits label editing mode.
   * @param newValue The new label text value.
   */
  function handleLabelEdit(newValue: string) {
    updateElement({ ...el, name: newValue });
    setEditingLabel(false);
  }

  /**
   * @function renderLabelEditor
   * @brief Renders an input field for editing element labels.
   * @returns JSX elements for the label editor or null if not in edit mode.
   * @description Shows a text input with background when editing labels.
   */
  function renderLabelEditor() {
    if (el.type === "text" || !editingLabel) return null;
    
    const labelX = (el.start.x + el.end.x) / 2 + (el.labelOffset?.dx || 0);
    const labelY = (el.start.y) + (el.labelOffset?.dy || -30);
    const paddingX = 8;
    const paddingY = 4;
    const fontSize = 14;
    const text = editValue;
    const textWidth = text.length * fontSize * 0.6;
    const textHeight = fontSize + 2;
    
    return (
      <>
        <rect
          className="element-label-background"
          x={labelX - textWidth / 2 - paddingX}
          y={labelY - textHeight / 2 - paddingY}
          width={textWidth + paddingX * 2}
          height={textHeight + paddingY * 2}
        />
        <foreignObject
          className="foreign-object-container"
          x={labelX - 50}
          y={labelY - 18}
          onPointerEnter={() => setLabelHovered(true)}
          onPointerLeave={() => setLabelHovered(false)}
        >
          <input
            type="text"
            className="label-input"
            value={editValue}
            autoFocus
            onChange={e => setEditValue(e.target.value)}
            onBlur={() => handleLabelEdit(editValue)}
            onKeyDown={e => {
              if (e.key === "Enter") handleLabelEdit(editValue);
              if (e.key === "Escape") setEditingLabel(false);
            }}
          />
        </foreignObject>
      </>
    );
  }

  /**
   * @function handleTextDoubleClick
   * @brief Handles double-click on text elements to enter edit mode.
   * @param e The mouse event from the text element.
   */
  function handleTextDoubleClick(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingText(true);
    setEditTextValue(el.text || "");
  }

  /**
   * @function renderTextContent
   * @brief Renders the text content for text-type elements.
   * @returns JSX element for the text content or null if not applicable.
   * @description Only shown for text elements when not in edit mode.
   */
  function renderTextContent() {
    if (el.type !== "text" || editingText) return null;
    
    return (
      <text
        className="element-text-content"
        x={(el.start.x + el.end.x) / 2}
        y={(el.start.y + el.end.y) / 2}
        onDoubleClick={handleTextDoubleClick}
      >
        {"Text"}
      </text>
    );
  }

  /**
   * @function handleTextEdit
   * @brief Updates the element's text content and exits text editing mode.
   * @param newValue The new text content value.
   */
  function handleTextEdit(newValue: string) {
    updateElement({ ...el, text: newValue });
    setEditingText(false);
  }

  /**
   * @function renderTextEditor
   * @brief Renders an input field for editing text element content.
   * @returns JSX element for the text editor or null if not in edit mode.
   * @description Shows a text input when editing text elements.
   */
  function renderTextEditor() {
    if (el.type !== "text" || !editingText) return null;
    
    return (
      <foreignObject
        className="foreign-object-container"
        x={(el.start.x + el.end.x) / 2 - 50}
        y={(el.start.y + el.end.y) / 2 - 15}
      >
        <input
          type="text"
          className="text-input"
          value={editTextValue}
          autoFocus
          onChange={e => setEditTextValue(e.target.value)}
          onBlur={() => handleTextEdit(editTextValue)}
          onKeyDown={e => {
            if (e.key === "Enter") handleTextEdit(editTextValue);
            if (e.key === "Escape") setEditingText(false);
          }}
        />
      </foreignObject>
    );
  }

  /**
   * @function handleShapeElementEdit
   * @brief Updates a shape element's properties and exits edit mode.
   * @param shapeElementId The ID of the shape element being edited.
   * @param newData The new shape element data.
   */
  function handleShapeElementEdit(shapeElementId: string, newData: any) {
    if (!updateElement || !el.shapeElements) return;
    
    const updatedShapeElements = el.shapeElements.map((se: ShapeElement) => 
      se.id === shapeElementId ? { ...se, ...newData } : se
    );
    
    updateElement({ ...el, shapeElements: updatedShapeElements });
    setEditingShapeElement(null);
    setEditShapeElementData(null);
  }

  /**
   * @function handleTextRegionDoubleClick
   * @brief Handles double-click on text regions to enter edit mode.
   * @param regionIndex The index of the text region being edited.
   * @param e The mouse event.
   */
  function handleTextRegionDoubleClick(regionIndex: number, e: React.MouseEvent) {
    e.stopPropagation();
    // Text editing with new structure requires more complex logic
    // For now, disable direct editing - use PropertiesPanel instead
    console.log('Text editing for element with standardized textRegions not yet implemented', regionIndex);
  }

  /**
   * @function handleTextRegionEdit
   * @brief Updates a text region's content and exits edit mode.
   * @param regionIndex The index of the region being edited.
   * @param newValue The new text value.
   */
  function handleTextRegionEdit(regionIndex: number, newValue: string) {
    // Text editing with new structure requires more complex logic
    // For now, disable direct editing - use PropertiesPanel instead
    console.log('Text editing for element with standardized textRegions not yet implemented', regionIndex, newValue);
    setEditingTextRegion(null);
  }

  /**
   * @function renderTextRegions
   * @brief Renders interactive text regions for complex shapes like UML classes.
   * @returns Array of JSX elements for text regions.
   */
  function renderTextRegions() {
    // Get text regions from shapeElements (standardized approach)
    const allTextRegions = el.shapeElements ? collectTextRegionsFromShapeElements(el.shapeElements) || [] : [];
      
    if (allTextRegions.length === 0) return null;

    const adjustedRegions = calculateAdjustedTextRegions(el);

    return adjustedRegions.map((adjustedRegion: any) => {
      if (editingTextRegion === adjustedRegion.index) {
        // Render textarea for editing
        return (
          <foreignObject
            key={`region-edit-${adjustedRegion.index}`}
            x={adjustedRegion.scaledX}
            y={adjustedRegion.scaledY - 5}
            width={adjustedRegion.scaledWidth}
            height={Math.max(adjustedRegion.scaledHeight, 20)}
          >
            <textarea
              className="label-input"
              value={editRegionValue}
              autoFocus
              style={{
                fontSize: `${adjustedRegion.fontSize}px`,
                textAlign: adjustedRegion.align || 'center',
                background: 'rgba(255, 255, 255, 0.9)',
                border: '1px solid #1976d2',
                width: '100%',
                height: '100%',
                resize: 'none',
              }}
              onChange={e => setEditRegionValue(e.target.value)}
              onBlur={() => handleTextRegionEdit(adjustedRegion.index, editRegionValue)}
              onKeyDown={e => {
                if (e.key === "Escape") setEditingTextRegion(null);
              }}
            />
          </foreignObject>
        );
      }

      // Render clickable text region
      return (
        <g key={`region-${adjustedRegion.index}`}>
          {/* Invisible clickable area */}
          <rect
            x={adjustedRegion.scaledX}
            y={adjustedRegion.scaledY}
            width={adjustedRegion.scaledWidth}
            height={adjustedRegion.scaledHeight}
            fill="transparent"
            style={{ cursor: "text" }}
            onDoubleClick={e => handleTextRegionDoubleClick(adjustedRegion.index, e)}
          />
          {/* Text content */}
          <g key={`region-${adjustedRegion.index}-lines`}>
            {adjustedRegion.lines.map((line: string, lineIndex: number) => (
              <text
                key={`region-${adjustedRegion.index}-line-${lineIndex}`}
                x={adjustedRegion.scaledX + (adjustedRegion.align === 'left' ? 5 : adjustedRegion.align === 'right' ? adjustedRegion.scaledWidth - 5 : adjustedRegion.scaledWidth / 2)}
                y={adjustedRegion.scaledY + adjustedRegion.scaledHeight / 2 + lineIndex * adjustedRegion.fontSize}
                fontSize={adjustedRegion.fontSize}
                textAnchor={adjustedRegion.align || 'center'}
                dominantBaseline="middle"
                fill="#000"
                className="shape-text-region"
              >
                {line}
              </text>
            ))}
          </g>
        </g>      );
    });
  }

  /**
   * @function renderShapeElementEditor
   * @brief Renders a simple property editor for shape elements.
   * @returns JSX element for the shape element editor or null.
   */
  function renderShapeElementEditor() {
    if (!editingShapeElement || !editShapeElementData) return null;

    return (
      <foreignObject
        x={el.start.x + 10}
        y={el.start.y + 10}
        width={300}
        height={150}
      >
        <div 
          style={{
            background: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
            padding: '10px',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif'
          }}
        >
          <div style={{ marginBottom: '10px', fontWeight: 'bold' }}>
            Edit SVG element: {editingShapeElement}
          </div>
          
          {/* SVG Content Editor */}
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>SVG Content:</label>
            <textarea
              value={editShapeElementData.svg || ''}
              onChange={(e) => setEditShapeElementData({
                ...editShapeElementData,
                svg: e.target.value
              })}
              style={{
                width: '100%',
                height: '60px',
                fontSize: '11px',
                fontFamily: 'monospace',
                border: '1px solid #ccc',
                borderRadius: '3px',
                padding: '5px'
              }}
              placeholder="Enter SVG content (e.g., <rect x='0' y='0' width='10' height='10' fill='red'/>)"
            />
          </div>

          {/* Buttons */}
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={() => handleShapeElementEdit(editingShapeElement, editShapeElementData)}
              style={{
                marginRight: '5px',
                padding: '4px 8px',
                background: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingShapeElement(null);
                setEditShapeElementData(null);
              }}
              style={{
                padding: '4px 8px',
                background: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      </foreignObject>
    );
  }

  // --- Main Render ---
  const rect = getElementBoundingRect(el);

  return (
    <g
      className={`element-container ${isSelected ? 'selected' : ''}`}
      onPointerDown={e => {
        if (!labelDragging) handlePointerDown(e, el);
      }}
      onPointerEnter={() => setHoveredElementId(el.id)}
      onPointerLeave={() => setHoveredElementId(null)}
    >
      {renderSelectionHighlight()}
      {isSelected && renderResizeHandles(rect)}
      {renderElementContent()}
      {renderTextRegions()}
      {renderShapeElementEditor()}
      {renderLabelBackground()}
      {renderLabel()}
      {renderLabelEditor()}
      {renderRotationHandle()}
      {renderTextContent()}
      {renderTextEditor()}
    </g>
  );
}

/**
 * @function collectTextRegionsFromShapeElements
 * @brief Collects all text regions from shape elements.
 * @param shapeElements Array of shape elements
 * @returns Combined array of text regions with shape element reference
 */
export function collectTextRegionsFromShapeElements(shapeElements: ShapeElement[]) {
  if (!shapeElements || shapeElements.length === 0) return [];
  
  const allTextRegions: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    text: string;
    fontSize?: number;
    align?: 'left' | 'center' | 'right';
    shapeElementId: string; // Reference to the parent shape element
  }> = [];
  
  shapeElements.forEach(shapeElement => {
    if (shapeElement.textRegions && shapeElement.textRegions.length > 0) {
      shapeElement.textRegions.forEach(region => {
        allTextRegions.push({
          ...region,
          shapeElementId: shapeElement.id
        });
      });
    }
  });
  
  return allTextRegions;
}

