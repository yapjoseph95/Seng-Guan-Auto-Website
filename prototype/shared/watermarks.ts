export type WatermarkPlacement = {
 watermarkId: string
 x: number
 y: number
 scale: number
 opacity: number
}

export type WatermarkAsset = { id: string; name: string; url: string; defaults?:WatermarkDefaults }

export const maxWatermarksPerPhoto = 10

export type WatermarkDefaults = Pick<WatermarkPlacement,'scale' | 'opacity'>
export const defaultWatermarkSettings: WatermarkDefaults = {scale:.28,opacity:.8}
export type WatermarkLibraryData = {watermarks:WatermarkAsset[]; defaults:WatermarkDefaults}
