declare module '*.css' {
  const content: string;
  export default content;
}

declare module '@maxgraph/core/css/*' {
  const content: string;
  export default content;
}

declare module '*.xml?raw' {
  const content: string;
  export default content;
}
