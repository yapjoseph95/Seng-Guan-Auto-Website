export const mileageBands = [20000, 40000, 60000, 80000, 100000, 150000, 200000, 250000, 250001] as const
export type MileageBand = typeof mileageBands[number]

export function isMileageBand(value: unknown): value is MileageBand {
  return mileageBands.some(band => band === value)
}

export function formatMileage(mileage: number | null | undefined, band: MileageBand | null | undefined, locale: string) {
  if (band == null) return mileage == null ? '' : `${mileage.toLocaleString(locale)} km`
  if (band === 250001) return `> ${(250000).toLocaleString(locale)} km`
  const previous = mileageBands[mileageBands.indexOf(band) - 1]
  const lower = previous == null ? 0 : previous + 1
  return `${lower.toLocaleString(locale)} – ${band.toLocaleString(locale)} km`
}
