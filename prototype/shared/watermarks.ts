export type WatermarkPlacement = {
 watermarkId: string
 x: number
 y: number
 scale: number
 opacity: number
}

export type WatermarkAsset = { id: string; name: string; url: string }

export const maxWatermarksPerPhoto = 10
