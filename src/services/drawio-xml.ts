/**
 * @file drawio-xml.ts
 * @brief Compatibility re-export: the draw.io XML codec lives in src/format/drawio-xml.ts (core
 *        layer, so maxGraph setup code such as drawio-shapes can use it without depending on the
 *        services layer). Import from '../format/drawio-xml' in new code.
 */
export * from '../format/drawio-xml';
