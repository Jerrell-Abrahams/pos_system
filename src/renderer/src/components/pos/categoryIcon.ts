const ICONS: Record<string, string> = {
  Beers: '🍺',
  'Ciders & RTDs': '🍹',
  Spirits: '🥃',
  'Soft Drinks & Water': '🥤',
  Snacks: '🍿'
}

export function categoryIcon(name: string): string {
  return ICONS[name] ?? '🏷️'
}
