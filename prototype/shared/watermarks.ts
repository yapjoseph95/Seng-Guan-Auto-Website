export type WatermarkPlacement = {
 watermarkId: string
 x: number
 y: number
 scale: number
 opacity: number
}

export type WatermarkAsset = { id: string; name: string; url: string; defaults?:WatermarkDefaults }

export const maxWatermarksPerPhoto = 10

export type WatermarkDefaults = Omit<WatermarkPlacement,'watermarkId'>
export const defaultWatermarkSettings: WatermarkDefaults = {x:.95,y:.95,scale:.28,opacity:.8}
export type WatermarkLibraryData = {watermarks:WatermarkAsset[]; defaults:Pick<WatermarkDefaults,'scale' | 'opacity'>}
