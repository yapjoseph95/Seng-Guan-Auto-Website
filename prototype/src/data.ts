import car1 from './assets/cars/1.jpg'
import car2 from './assets/cars/2.jpg'
import car3 from './assets/cars/3.jpg'
import car4 from './assets/cars/4.jpg'
import car5 from './assets/cars/5.jpg'
import car6 from './assets/cars/6.jpg'
import car7 from './assets/cars/7.jpg'
import car8 from './assets/cars/8.jpg'

export type PageId = 'home' | 'cars' | 'finance' | 'about' | 'faq' | 'contact'

export type Direction = {
  id: string
  short: string
  name: string
  tagline: string
  layout: string
  skills: string[]
  skillReason: string
}

export const pages: { id: PageId; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'cars', label: 'Cars' },
  { id: 'finance', label: 'Financing' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
]

export const directions: Direction[] = [
  {
    id: 'lot-712', short: '01', name: 'Lot 712',
    tagline: 'A welcoming local showroom with the real dealership front and centre.',
    layout: 'Location-led / roadside identity',
    skills: ['taste-skill', 'Impeccable'],
    skillReason: 'Uses the location and supplied dealership photography to make the business feel specific, then keeps the next step easy to find.',
  },
  {
    id: 'drive-finder', short: '02', name: 'Find Your Drive',
    tagline: 'Start with the car search, then move directly into a useful conversation.',
    layout: 'Search-first / utility',
    skills: ['UI UX Pro Max', 'Web Design Guidelines'],
    skillReason: 'Prioritizes search, readable vehicle details, keyboard access, and a clear route to current listings.',
  },
  {
    id: 'night-shift', short: '03', name: 'Night Shift',
    tagline: 'A sharper enthusiast direction, with one measured motion sequence.',
    layout: 'Cinematic / performance',
    skills: ['Frontend Design', 'GSAP Core', 'GSAP Timeline', 'GSAP ScrollTrigger'],
    skillReason: 'Gives this route its own automotive visual language and uses GSAP only for the hero entrance and one scroll reveal.',
  },
  {
    id: 'everyday-miles', short: '04', name: 'Everyday Miles',
    tagline: 'A calm, people-first direction for buyers planning daily drives and family trips.',
    layout: 'Household / reassurance',
    skills: ['Impeccable', 'UI UX Pro Max'],
    skillReason: 'Organizes the buying journey around practical questions: vehicle fit, payment estimate, and how to visit.',
  },
  {
    id: 'the-collection', short: '05', name: 'The Collection',
    tagline: 'A quieter, photography-led showroom for shoppers who want to browse slowly.',
    layout: 'Curated / image-led',
    skills: ['Refero Design', 'Frontend Design'],
    skillReason: 'Uses a strong media role and a restrained gallery composition rather than a generic feature-card stack.',
  },
  {
    id: 'spec-ledger', short: '06', name: 'Spec Ledger',
    tagline: 'Put the information beside the vehicle so comparisons feel straightforward.',
    layout: 'Specification / comparison',
    skills: ['UI UX Pro Max', 'Web Design Guidelines'],
    skillReason: 'Treats vehicle attributes as structured information and keeps labels, filters, and inquiry actions explicit.',
  },
  {
    id: 'drive-journal', short: '07', name: 'Drive Journal',
    tagline: 'A local automotive journal that connects the cars, the people, and the place.',
    layout: 'Editorial / local story',
    skills: ['Refero Design', 'Web Artifacts Builder'],
    skillReason: 'Synthesizes editorial reference patterns with a multi-page, component-based prototype that can be shared as one file.',
  },
  {
    id: 'open-lot', short: '08', name: 'Open Lot',
    tagline: 'An unapologetic classifieds board: direct, dense, and easy to scan.',
    layout: 'Market board / brutalist',
    skills: ['taste-skill', 'UI UX Pro Max'],
    skillReason: 'Tests a structurally different, high-contrast listing board drawn from the Pro Max style search, not a color-only variation.',
  },
  {
    id: 'monthly-key', short: '09', name: 'Monthly Key',
    tagline: 'Lead with the monthly estimate and make the assumptions visible.',
    layout: 'Finance-first / guided choice',
    skills: ['Impeccable', 'UI UX Pro Max'],
    skillReason: 'Makes the calculator the first useful action while keeping the estimate clearly illustrative and local to the browser.',
  },
  {
    id: 'clear-route', short: '10', name: 'Clear Route',
    tagline: 'A crisp, no-fuss alternative that keeps the site familiar and unusually clear.',
    layout: 'Swiss / concise',
    skills: ['Web Design Guidelines', 'Web Artifacts Builder'],
    skillReason: 'Uses strong hierarchy, semantic controls, deep links, and the artifact builder’s standalone preview workflow.',
  },
  {
    id: 'greenlight', short: '11', name: 'Showroom Redline',
    tagline: 'A direct, high-contrast used-car dealership homepage with the stock up front.',
    layout: 'Automotive / stock-first',
    skills: ['Inter', 'CARNET', 'DConcept', 'Yui Hui Auto'],
    skillReason: 'Uses CARNET’s bold black-and-red automotive identity, brings DConcept’s ready-stock emphasis forward, and keeps Yui Hui’s direct dealer navigation. It uses only the vehicle details supplied for Seng Guan Auto.',
  },
]

export type Vehicle = {
  id: number
  name: string
  make: string
  year: string
  body: string
  fuel: string
  transmission: string
  photo: string
}

// Sample stock and descriptions copied from the existing homepage for layout evaluation.
// Availability, price, and mileage are intentionally not shown as live data.
export const vehicles: Vehicle[] = [
  { id: 1, name: 'Toyota Harrier 2.4 G', make: 'Toyota', year: '2008', body: 'SUV', fuel: 'Petrol', transmission: 'Automatic', photo: car1 },
  { id: 2, name: 'BMW 530i 2.0', make: 'BMW', year: '2024', body: 'Sedan', fuel: 'Petrol', transmission: 'Automatic', photo: car2 },
  { id: 3, name: 'Perodua Myvi 1.3 Ezi', make: 'Perodua', year: '2013', body: 'Hatchback', fuel: 'Petrol', transmission: 'Automatic', photo: car3 },
  { id: 4, name: 'Toyota Vellfire 2.4 Z', make: 'Toyota', year: '2013', body: 'MPV', fuel: 'Petrol', transmission: 'Automatic', photo: car4 },
  { id: 5, name: 'Toyota Camry 2.0 G', make: 'Toyota', year: '2004', body: 'Sedan', fuel: 'Petrol', transmission: 'Automatic', photo: car5 },
  { id: 6, name: 'Honda Civic 1.8 S', make: 'Honda', year: '2016', body: 'Sedan', fuel: 'Petrol', transmission: 'Automatic', photo: car6 },
  { id: 7, name: 'Toyota Estima 2.0 G', make: 'Toyota', year: '2010', body: 'MPV', fuel: 'Petrol', transmission: 'Automatic', photo: car7 },
  { id: 8, name: 'Perodua Myvi 1.5 SE', make: 'Perodua', year: '2014', body: 'Hatchback', fuel: 'Petrol', transmission: 'Automatic', photo: car8 },
]

export const contact = {
  address: 'Lot 712, Batu 18, Jln Klang Banting, Taman Langat Jaya, 42700 Banting, Selangor',
  phone: '+6 03-3187 6199',
  phoneHref: 'tel:+60331876199',
  whatsapp: 'https://wa.me/60162182727',
  email: 'support@sengguanauto.com.my',
  hours: [
    ['Monday–Friday', '9:00 AM–6:00 PM'],
    ['Saturday', '9:00 AM–5:00 PM'],
    ['Sunday', 'Closed'],
  ],
  inventory: 'https://www.carlist.my/dealer/sengguanauto',
}

export const faqItems = [
  { category: 'Vehicles', question: 'What vehicles are featured on this site?', answer: 'The prototype uses the 8 vehicle examples from the current homepage. For live stock, prices, and mileage, open the Seng Guan Auto listings on Carlist.' },
  { category: 'Vehicles', question: 'Can I arrange a test drive?', answer: 'Contact the dealership by phone or WhatsApp to ask about the vehicle you are interested in and arrange a suitable time.' },
  { category: 'Financing', question: 'Can I estimate a monthly payment?', answer: 'Use the on-page calculator to create an illustrative estimate from the car price, down payment, rate, and loan term you enter. Confirm actual rates and terms with the dealership and finance provider.' },
  { category: 'Financing', question: 'What documents might I need?', answer: 'The current site lists identity, driving licence, and income or employment documents as common requirements. Ask the team which documents apply to your situation.' },
  { category: 'Financing', question: 'How long does loan approval take?', answer: 'Timing depends on the finance provider and application. Contact the team for guidance on a specific vehicle and application.' },
  { category: 'Services', question: 'Can you help with insurance and registration?', answer: 'The current site says the team can help with vehicle registration and insurance. Confirm the steps and any fees before proceeding.' },
  { category: 'Services', question: 'Can I ask about a trade-in?', answer: 'Contact the dealership with your current vehicle details to discuss whether a trade-in can be considered.' },
  { category: 'Warranty', question: 'What warranty applies to a specific car?', answer: 'Coverage may depend on the vehicle and the policy. Ask for the written terms for that vehicle before making a decision.' },
]

export const testimonials = [] as const
