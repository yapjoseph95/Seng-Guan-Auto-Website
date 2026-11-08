export const vehicleTemplateLanguages = [
 { id:'en', label:'English' },
 { id:'ms', label:'Bahasa Melayu' },
 { id:'zh', label:'简体中文' },
] as const

export type VehicleTemplateLanguage = typeof vehicleTemplateLanguages[number]['id']
export type VehicleTemplate = Record<VehicleTemplateLanguage,string>
export const emptyVehicleTemplate: VehicleTemplate = { en:'', ms:'', zh:'' }
export const vehicleTemplateMaxLength = 3000
