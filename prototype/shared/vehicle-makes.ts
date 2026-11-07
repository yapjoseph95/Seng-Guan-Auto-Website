const commonMakes = [
 'Audi', 'BMW', 'BYD', 'Chery', 'Ford', 'GWM', 'Honda', 'Hyundai', 'Isuzu', 'Jaecoo',
 'Kia', 'Lexus', 'Mazda', 'Mercedes-Benz', 'MG', 'MINI', 'Mitsubishi', 'Nissan',
 'Perodua', 'Peugeot', 'Porsche', 'Proton', 'Subaru', 'Suzuki', 'Toyota', 'Volkswagen', 'Volvo',
]

const cleanMake = (make: string) => make.trim().replace(/\s+/g,' ')
export const vehicleMakeKey = (make: string) => cleanMake(make).toLowerCase()
const officialMakes = new Map(commonMakes.map(make => [vehicleMakeKey(make),make]))

export const officialVehicleMake = (make: string) => officialMakes.get(vehicleMakeKey(make))

export function canonicalVehicleMake(make: string) {
 return officialVehicleMake(make) ?? cleanMake(make)
}

export function vehicleMakeOptions(makes: string[], includeCommon = false) {
 const options = new Map<string,string>(includeCommon ? officialMakes : undefined)
 for (const make of makes) {
  const key = vehicleMakeKey(make)
  if (key && !options.has(key)) options.set(key,canonicalVehicleMake(make))
 }
 return [...options].sort((a,b) => a[1].localeCompare(b[1]))
}
