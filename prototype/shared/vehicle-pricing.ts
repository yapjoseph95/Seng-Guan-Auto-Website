export function getVehicleDiscount(
 price: number | null | undefined,
 discountPrice: number | null | undefined,
): { percent: number } | null {
 if (!Number.isSafeInteger(price) || !Number.isSafeInteger(discountPrice)
  || price! <= 0 || discountPrice! <= 0 || discountPrice! >= price!) return null
 return { percent: Math.round((price! - discountPrice!) / price! * 100) }
}
