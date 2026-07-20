export function objectToStyleString(styleObj: Record<string, any>): string {
  return Object.entries(styleObj)
    .map(([key, value]) => {
      if (value === null || value === undefined) return '';
      return `${key}=${value}`;
    })
    .filter((s) => s.length > 0)
    .join(';');
}

export function styleStringToObject(styleStr: string): Record<string, any> {
  const obj: Record<string, any> = {};
  if (!styleStr) return obj;

  styleStr.split(';').forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) {
      obj[key] = value;
    }
  });

  return obj;
}
