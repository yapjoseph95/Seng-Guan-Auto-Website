import * as Slider from '@radix-ui/react-slider'
import WhatsAppGlyph from './WhatsAppGlyph'
import { vehicleMakeKey, vehicleMakeOptions } from '../shared/vehicle-makes'
import { getVehicleDiscount } from '../shared/vehicle-pricing'
import { useLocale, LanguageSelect } from './locale'
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Award, Calculator,
  CarFront, Check, ChevronDown, CircleHelp, Clock, HeartHandshake, Mail, MapPin,
  Headset, Image as ImageIcon, Menu, MessageCircle, Navigation, Phone, ReceiptText, RefreshCw, Search, ShieldCheck,
  Wrench, X,
} from 'lucide-react'
import logo from './assets/logo.svg'
import darkLogo from './assets/logo-dark.svg'
import showroom from './assets/showroom.jpg'
import showroomPreview from './assets/previews/showroom.jpg'
import team1Preview from './assets/previews/team1.jpg'
import team2Preview from './assets/previews/team2.jpg'
import team3Preview from './assets/previews/team3.jpg'
import angKinGuanPortrait from '../../resources/team/1.jpg'
import johnAngPortrait from '../../resources/team/2.jpg'
import angZiWeiPortrait from '../../resources/team/john.jpg'
import { contact, directions, faqItems, pages, vehicles as fallbackVehicles, type Direction, type PageId, type Vehicle } from './data'
import './App.css'
import { useVehiclePages } from './useVehiclePages'
import { ProgressiveImage, ListingTransition, LoadMore, entranceStyle } from './LoadingVisuals'
import VehicleDetails, { VehicleListingDate, VehicleSpecs, VehicleUnavailable } from './VehicleDetails'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type RouteState = { variant: string; page: PageId }

const isOfficialSite = import.meta.env.VITE_OFFICIAL_SITE === 'true'
const publicPaths: Record<PageId, string> = { home: '/', cars: '/cars', finance: '/financing', about: '/about', faq: '/faq', contact: '/contact' }

const InventoryContext = createContext<Vehicle[]>(fallbackVehicles)
const InventoryStatusContext = createContext<'loading' | 'ready' | 'error'>('ready')
const useVehicles = () => useContext(InventoryContext)
const useFeaturedVehicles = () => useVehicles().filter(v => (v.status === 'available' || !v.status) && v.featured !== false)

const defaultRoute: RouteState = { variant: 'greenlight', page: 'home' }

function readRoute(): RouteState {
  const fileHash = window.location.protocol === 'file:' ? window.location.hash.replace(/^#\??/, '') : ''
  const params = new URLSearchParams(fileHash || window.location.search)
  const variant = !isOfficialSite && directions.some((item) => item.id === params.get('variant'))
    ? params.get('variant')!
    : defaultRoute.variant
  const page = pages.some((item) => item.id === params.get('page'))
    ? params.get('page') as PageId
    : (Object.entries(publicPaths).find(([, path]) => path === window.location.pathname.replace(/\.html$/, '').replace(/\/$/, '') || path === '/' && window.location.pathname === '/')?.[0] as PageId | undefined) ?? defaultRoute.page
  return { variant, page }
}

function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>) {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey
}

function preventImageDrag(event: DragEvent<HTMLDivElement>) {
  if (event.target instanceof Element && event.target.closest('img')) event.preventDefault()
}

function preventImageContextMenu(event: MouseEvent<HTMLDivElement>) {
  if (event.target instanceof Element && event.target.closest('img')) event.preventDefault()
}

function App() {
  const { t } = useLocale()
  useEffect(() => { ScrollTrigger.refresh() }, [t])
  const [inventory, setInventory] = useState<Vehicle[]>(isOfficialSite ? [] : fallbackVehicles)
  const [inventoryStatus, setInventoryStatus] = useState<'loading' | 'ready' | 'error'>(isOfficialSite ? 'loading' : 'ready')
  const [route, setRoute] = useState<RouteState>(readRoute)
  useEffect(() => {
    if (!isOfficialSite || route.page !== 'home') return
    const controller = new AbortController()
    const load = () => fetch('/api/vehicles?limit=12&featured=1', { signal: controller.signal, cache: 'no-store' }).then(r => { if (!r.ok) throw Error('Inventory unavailable'); return r.json() }).then(data => { if (!Array.isArray(data.vehicles)) throw Error('Invalid inventory'); setInventory(data.vehicles.map((v: Vehicle) => ({ ...v, year: String(v.year) }))); setInventoryStatus('ready') }).catch(() => { if (!controller.signal.aborted) setInventoryStatus('error') })
    void load()
    window.addEventListener('focus', load)
    return () => { controller.abort(); window.removeEventListener('focus', load) }
  }, [route.page])
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [savedDirection, setSavedDirection] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const appRef = useRef<HTMLDivElement>(null)
  const variant = directions.find((item) => item.id === route.variant) ?? directions[0]

  const updateRoute = (next: RouteState, push = true) => {
    const url = new URL(window.location.href)
    if (isOfficialSite) {
      url.pathname = publicPaths[next.page]
      url.search = ''
      url.hash = ''
    } else if (window.location.protocol === 'file:') {
      const hash = new URLSearchParams({ variant: next.variant, page: next.page })
      url.search = ''
      url.hash = hash.toString()
    } else {
      url.searchParams.set('variant', next.variant)
      url.searchParams.set('page', next.page)
    }
    window.history[push ? 'pushState' : 'replaceState']({}, '', url)
    setRoute(next)
    setMenuOpen(false)
    setDetailsOpen(false)
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const goToPage = (page: PageId) => updateRoute({ ...route, page })
  const goToVariant = (variantId: string) => updateRoute({ ...route, variant: variantId })

  useEffect(() => {
    const onPopState = () => setRoute(readRoute())
    const onHashChange = () => {
      if (window.location.protocol === 'file:') setRoute(readRoute())
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (isOfficialSite) return
      const target = event.target as HTMLElement | null
      const isEditing = target?.matches('input, textarea, select, [contenteditable="true"]')
      if (isEditing || event.altKey || event.metaKey || event.ctrlKey) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      event.preventDefault()
      const currentIndex = directions.findIndex((item) => item.id === route.variant)
      const offset = event.key === 'ArrowRight' ? 1 : -1
      const nextIndex = (currentIndex + offset + directions.length) % directions.length
      goToVariant(directions[nextIndex].id)
    }
    window.addEventListener('popstate', onPopState)
    window.addEventListener('hashchange', onHashChange)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('hashchange', onHashChange)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [route])

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 2600)
    return () => window.clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    const snapEnabled = route.page === 'home' || route.page === 'about'
    if (snapEnabled) document.documentElement.dataset.scrollSnap = 'sections'
    else delete document.documentElement.dataset.scrollSnap
    return () => { delete document.documentElement.dataset.scrollSnap }
  }, [route.page])

  useGSAP(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      if (route.variant === 'greenlight') {
        gsap.fromTo('.site-atmosphere', { y: 0 }, {
          y: -36,
          ease: 'none',
          scrollTrigger: {
            trigger: appRef.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 1.2,
            invalidateOnRefresh: true,
          },
        })
      }

      gsap.fromTo('#main-content', { autoAlpha: 0, y: 12 }, {
        autoAlpha: 1,
        y: 0,
        duration: 0.42,
        ease: 'power2.out',
      })

      const revealTargets = gsap.utils.toArray<HTMLElement>(
        '#main-content > .home-flow > .section, #main-content > .content-page > *, .site-footer',
      )
      revealTargets.forEach((target) => {
        gsap.fromTo(target, { y: 22, opacity: 0 }, {
          y: 0,
          opacity: 1,
          duration: 0.62,
          ease: 'power3.out',
          scrollTrigger: { trigger: target, start: 'top 84%', once: true },
        })
      })

      if (route.variant === 'greenlight' && route.page === 'home') {
        const intro = gsap.timeline({ defaults: { duration: 0.72, ease: 'power3.out' } })
        intro
          .fromTo('.showroom-kicker', { y: 18, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, 0)
          .fromTo('.showroom-copy h1', { y: 30, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, '<0.08')
          .fromTo('.showroom-copy > p:not(.showroom-kicker)', { y: 20, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, '<0.12')
          .fromTo('.showroom-actions .button', { y: 16, autoAlpha: 0 }, { y: 0, autoAlpha: 1, stagger: 0.1 }, '<0.1')

        gsap.fromTo('.showroom-photo', { yPercent: -2, scale: 1.06 }, {
          yPercent: 5,
          scale: 1.1,
          ease: 'none',
          scrollTrigger: { trigger: '.hero--showroom', start: 'top top', end: 'bottom top', scrub: 0.8 },
        })

        gsap.to('.showroom-gallery-column--1', {
          y: -34,
          ease: 'none',
          scrollTrigger: { trigger: '.featured-showcase', start: 'top bottom', end: 'bottom top', scrub: 1 },
        })
        gsap.to('.showroom-gallery-column--2', {
          y: 26,
          ease: 'none',
          scrollTrigger: { trigger: '.featured-showcase', start: 'top bottom', end: 'bottom top', scrub: 1 },
        })
        gsap.to('.showroom-gallery-column--3', {
          y: -18,
          ease: 'none',
          scrollTrigger: { trigger: '.featured-showcase', start: 'top bottom', end: 'bottom top', scrub: 1 },
        })
      }

      if (route.variant === 'night-shift') {
        const intro = gsap.timeline({ defaults: { duration: 0.72, ease: 'power3.out' } })
        intro
          .fromTo('.hero-copy', { y: 22, autoAlpha: 0, filter: 'blur(8px)' }, { y: 0, autoAlpha: 1, filter: 'blur(0px)' }, 0)
          .fromTo('.hero-art', { clipPath: 'inset(0 100% 0 0)' }, { clipPath: 'inset(0 0% 0 0)' }, '<0.1')
      }
    })
    return () => media.revert()
  }, { scope: appRef, dependencies: [route.variant, route.page], revertOnUpdate: true })

  const showNotice = (message: string) => {
    setNotice(message)
  }

  const copyDirectionLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      showNotice(t('Link copied'))
    } catch {
      showNotice(t('Copy the address in your browser to share this direction.'))
    }
  }

  const navTo = (page: PageId) => isOfficialSite ? publicPaths[page] : window.location.protocol === 'file:'
    ? `#variant=${variant.id}&page=${page}`
    : `?variant=${variant.id}&page=${page}`
  const interceptRoute = (page: PageId) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event)) return
    event.preventDefault()
    goToPage(page)
  }

  const pageContent = () => {
    switch (route.page) {
      case 'cars': return <InventoryPage variant={variant} />
      case 'finance': return <FinancePage variant={variant} />
      case 'about': return <AboutPage variant={variant} goToPage={goToPage} />
      case 'faq': return <FaqPage variant={variant} />
      case 'contact': return <ContactPage variant={variant} />
      default: return <HomePage variant={variant} goToPage={goToPage} />
    }
  }

  return (
    <InventoryContext.Provider value={inventory}>
    <InventoryStatusContext.Provider value={inventoryStatus}>
    <div className={`prototype-app${isOfficialSite ? ' is-official-site' : ''}`} data-variant={variant.id} ref={appRef} onDragStart={preventImageDrag} onContextMenu={preventImageContextMenu}>
      {variant.id === 'greenlight' && <div className="site-atmosphere" aria-hidden="true" />}
      <a className="skip-link" href="#main-content">{t("Skip to content")}</a>
      <SiteHeader
        variant={variant}
        activePage={route.page}
        navTo={navTo}
        interceptRoute={interceptRoute}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
      />
      <main id="main-content" key={`${route.variant}-${route.page}`} className={`page page--${route.page}`}>
        {pageContent()}
      </main>
      <SiteFooter variant={variant} goToPage={goToPage} />
      {!isOfficialSite && <PrototypeDock
        variant={variant}
        currentPage={route.page}
        goToVariant={goToVariant}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        copyDirectionLink={copyDirectionLink}
        saved={savedDirection === variant.id}
        selectDirection={() => {
          setSavedDirection(variant.id)
          showNotice(t('{name} marked for review in this session.', { name: variant.name }))
        }}
      />}
      <div className="notice" aria-live="polite" aria-atomic="true">{notice}</div>
    </div>
    </InventoryStatusContext.Provider>
    </InventoryContext.Provider>
  )
}

function SiteHeader({
  variant, activePage, navTo, interceptRoute, menuOpen, setMenuOpen,
}: {
  variant: Direction
  activePage: PageId
  navTo: (page: PageId) => string
  interceptRoute: (page: PageId) => (event: MouseEvent<HTMLAnchorElement>) => void
  menuOpen: boolean
  setMenuOpen: (open: boolean) => void
}) {
  const { t } = useLocale()
  const brandLogo = variant.id === 'greenlight' ? darkLogo : logo
  const navRef = useRef<HTMLElement>(null)
  const navIndicatorRef = useRef<HTMLSpanElement>(null)

  useGSAP(() => {
    const nav = navRef.current
    const indicator = navIndicatorRef.current
    const activeLink = nav?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')
    if (!nav || !indicator || !activeLink || !window.matchMedia('(min-width: 941px)').matches) return

    gsap.to(indicator, {
      x: activeLink.offsetLeft,
      width: activeLink.offsetWidth,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.42,
      ease: 'power3.out',
      overwrite: true,
    })
  }, { dependencies: [activePage, t], scope: navRef })

  return (
    <header className={`site-header site-header--${variant.id}`}>
      <div className="header-inner">
        <a className="brand" href={navTo('home')} onClick={interceptRoute('home')} aria-label={t("Seng Guan Auto home")}>
          <span className={`brand-mark${variant.id === 'greenlight' ? ' brand-mark--dark' : ''}`}><img src={brandLogo} alt="Seng Guan Auto Sdn. Bhd." width="225" height="106" /></span>
          <span className="brand-caption">{t("Your trusted partner in quality used cars since 1995.")}</span>
        </a>
        <button className="menu-toggle" type="button" aria-label={t(menuOpen ? 'Close menu' : 'Open menu')} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav ref={navRef} className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label={t("Main navigation")}>
          {pages.map((page) => (
            <a key={page.id} href={navTo(page.id)} onClick={interceptRoute(page.id)} aria-current={activePage === page.id ? 'page' : undefined}>
              {t(page.label)}
            </a>
          ))}
          <a className="nav-inventory" href={contact.inventory} target="_blank" rel="noreferrer">{t("Current listings")} <ArrowUpRight aria-hidden="true" size={15} />
          </a>
          <span className="nav-indicator" ref={navIndicatorRef} aria-hidden="true" />
        </nav>
        <LanguageSelect />
        <a className="header-contact header-contact--whatsapp" href={contact.whatsapp} target="_blank" rel="noreferrer">
          <WhatsAppGlyph /> <span>{t("Ask about a car")}</span>
        </a>
        <CustomerServiceWidget enabled={variant.id === 'greenlight'} />
      </div>
    </header>
  )
}

function CustomerServiceWidget({ enabled }: { enabled: boolean }) {
  const { t } = useLocale()
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!enabled) {
      setOpen(false)
      setReady(false)
      return
    }

    setReady(false)
    let widgetShadow: ShadowRoot | null = null
    const originalAttachShadow = Element.prototype.attachShadow
    const patchedAttachShadow: typeof Element.prototype.attachShadow = function (this: Element, init) {
      const shadow = originalAttachShadow.call(this, init)
      if (this.localName === 'lime-chat-widget-host' && init.mode === 'closed') widgetShadow = shadow
      return shadow
    }
    Element.prototype.attachShadow = patchedAttachShadow

    const script = document.createElement('script')
    script.src = 'https://beta.kwoob.com/widget.js'
    script.dataset.widgetId = 'lcw_2104dc5cd4cd3d7fd9827e16e095d2cc'
    script.async = true

    let restoreTimer = 0
    const restoreAttachShadow = () => {
      if (Element.prototype.attachShadow === patchedAttachShadow) Element.prototype.attachShadow = originalAttachShadow
      window.clearTimeout(restoreTimer)
    }
    const styleWidget = () => {
      restoreAttachShadow()
      const shadow = widgetShadow
      if (!shadow) return

      const host = document.querySelector<HTMLElement>('lime-chat-widget-host[data-widget-id="lcw_2104dc5cd4cd3d7fd9827e16e095d2cc"]')
      host?.style.setProperty('right', '22px', 'important')
      host?.style.setProperty('bottom', '22px', 'important')
      const launcher = shadow.querySelector<HTMLButtonElement>('.launcher')
      const headsetIcon = buttonRef.current?.querySelector('svg')
      if (launcher && headsetIcon) launcher.replaceChildren(headsetIcon.cloneNode(true))

      const style = document.createElement('style')
      style.textContent = [
        '.launcher { width: 54px !important; height: 54px !important; border: 1px solid #f25a54 !important; border-radius: 7px !important; background: #e6322b !important; box-shadow: 0 10px 30px rgb(0 0 0 / 36%) !important; }',
        '.launcher:hover { background: #c92823 !important; box-shadow: 0 12px 34px rgb(0 0 0 / 42%) !important; }',
        '.launcher:focus-visible { outline-color: #f25a54 !important; }',
        '.panel { border: 1px solid #303438 !important; border-radius: 8px !important; box-shadow: 0 18px 58px rgb(0 0 0 / 52%) !important; }',
        'iframe { border-radius: 7px !important; }',
        '@media (max-width: 760px) {',
        '  :host { right: 0 !important; bottom: 0 !important; width: 0 !important; height: 0 !important; }',
        '  .launcher { display: none !important; }',
        '  .panel { position: fixed !important; top: 80px !important; right: 12px !important; bottom: auto !important; width: min(390px, calc(100vw - 24px)) !important; height: min(610px, calc(100dvh - 96px)) !important; transform-origin: top right !important; }',
        '}',
      ].join('\n')
      shadow.append(style)
      setReady(true)
    }

    script.addEventListener('load', styleWidget, { once: true })
    script.addEventListener('error', () => {
      restoreAttachShadow()
      setReady(false)
    }, { once: true })
    restoreTimer = window.setTimeout(restoreAttachShadow, 15000)
    document.head.append(script)

    const trigger = () => {
      const launcher = widgetShadow?.querySelector<HTMLButtonElement>('.launcher')
      if (!launcher) return
      launcher.click()
      setOpen(launcher.getAttribute('aria-expanded') === 'true')
    }
    const button = buttonRef.current
    button?.addEventListener('click', trigger)

    return () => {
      button?.removeEventListener('click', trigger)
      restoreAttachShadow()
      script.remove()
      document.querySelector('lime-chat-widget-host[data-widget-id="lcw_2104dc5cd4cd3d7fd9827e16e095d2cc"]')?.remove()
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <button ref={buttonRef} className="header-customer-service" type="button" aria-label={t(open ? 'Close customer service chat' : 'Open customer service chat')} aria-expanded={open} disabled={!ready}>
      <Headset aria-hidden="true" size={18} />
    </button>
  )
}

function HomePage({ variant, goToPage }: { variant: Direction; goToPage: (page: PageId) => void }) {
  return (
    <>
      <HomeHero variant={variant} goToPage={goToPage} />
      <div className={`home-flow home-flow--${variant.id}`}>
        {homeSections[variant.id].map((section) => {
          switch (section) {
            case 'cars': return <VehicleTeaser key={section} variantId={variant.id} goToPage={goToPage} />
            case 'finance': return <FinanceTeaser key={section} goToPage={goToPage} />
            case 'story': return <StoryTeaser key={section} variant={variant} goToPage={goToPage} />
            case 'visit': return <VisitTeaser key={section} goToPage={goToPage} />
            case 'faq': return <FaqTeaser key={section} goToPage={goToPage} />
            default: return null
          }
        })}
      </div>
    </>
  )
}

function FeaturedVehicleDisplay({ onBrowse }: { onBrowse: () => void }) {
  const { t } = useLocale()
  const vehicles = useFeaturedVehicles()
  const loading = useContext(InventoryStatusContext) === 'loading'
  const columns = Array.from({length: 3}, (_, column) => Array.from({length:4}, (_, row) => vehicles[(column * 4 + row) % vehicles.length])).filter(() => vehicles.length > 0)


  return (
    <div className="featured-display">
      {!columns.length && (loading ? <div className="hero-skeleton" aria-hidden="true" /> : <img className="featured-showroom-fallback" src={showroom} alt={t("Seng Guan Auto showroom")} />)}
      <div className="showroom-gallery" aria-hidden="true">
        {columns.map((column, columnIndex) => (
          <div className={`showroom-gallery-column showroom-gallery-column--${columnIndex + 1}`} key={columnIndex}>
            <div className="showroom-gallery-track">
              {[0, 1].map((loopIndex) => (
                <div className="showroom-gallery-set" key={loopIndex}>
                  {column.map((car, carIndex) => (
                    <div className="showroom-gallery-tile" key={`${loopIndex}-${car.id}-${carIndex}`}>
                      <ProgressiveImage src={car.photo} alt="" width="300" height="200" />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="showroom-image-overlay" aria-hidden="true" />
      <div className="showroom-art-copy">
        <button className="showroom-art-link" onClick={onBrowse}>{t("Explore featured cars")} <ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
  )
}

function ShowroomHeroImage() {
  const vehicles = useFeaturedVehicles()
  const loading = useContext(InventoryStatusContext) === 'loading'
  const [activeIndex, setActiveIndex] = useState(0)
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null)
  const activeIndexRef = useRef(0)

  useEffect(() => {
    activeIndexRef.current = 0
    setActiveIndex(0)
    setIncomingIndex(null)
    if (vehicles.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    let fadeTimeout = 0
    const interval = window.setInterval(() => {
      const nextIndex = (activeIndexRef.current + 1) % vehicles.length
      setIncomingIndex(nextIndex)
      fadeTimeout = window.setTimeout(() => {
        activeIndexRef.current = nextIndex
        setActiveIndex(nextIndex)
        setIncomingIndex(null)
      }, 900)
    }, 5000)

    return () => {
      window.clearInterval(interval)
      window.clearTimeout(fadeTimeout)
    }
  }, [vehicles.map(v => v.id + v.photo).join(',')])

  return (
    <div className="showroom-image" aria-hidden="true">
      {!vehicles.length && (loading ? <div className="hero-skeleton" aria-hidden="true" /> : <img className="showroom-photo showroom-photo--visible" src={showroom} alt="" />)}
      {vehicles.map((vehicle, index) => {
        if(index!==activeIndex && index!==incomingIndex && index!==(activeIndex+1)%vehicles.length)return null
        const isVisible = index === activeIndex && incomingIndex === null || index === incomingIndex
        return (
          <ProgressiveImage
            key={vehicle.id}
            containerClassName={`showroom-photo${isVisible ? ' showroom-photo--visible' : ''}`}
            src={vehicle.photo}
            alt=""
            width="300"
            height="200"
            priority={index === activeIndex}
          />
        )
      })}
    </div>
  )
}

const homeSections: Record<string, string[]> = {
  'lot-712': ['cars', 'story', 'finance', 'visit'],
  'drive-finder': ['cars', 'finance', 'visit', 'faq'],
  'night-shift': ['story', 'cars', 'finance', 'visit'],
  'everyday-miles': ['visit', 'cars', 'finance', 'faq'],
  'the-collection': ['cars', 'story', 'visit'],
  'spec-ledger': ['cars', 'faq', 'finance', 'visit'],
  'drive-journal': ['story', 'cars', 'faq', 'visit'],
  'open-lot': ['cars', 'visit', 'finance', 'story'],
  'monthly-key': ['finance', 'cars', 'story', 'visit'],
  'clear-route': ['cars', 'story', 'finance', 'visit'],
  'greenlight': ['cars', 'finance', 'story', 'visit'],
}

function HomeHero({ variant, goToPage }: { variant: Direction; goToPage: (page: PageId) => void }) {
  const { t } = useLocale()
  const vehicles = useVehicles()
  const primaryCar = vehicles[1]
  const budgetCar = vehicles[2]
  switch (variant.id) {
    case 'lot-712':
      return (
        <section className="hero hero--lot">
          <div className="hero-lot-copy hero-copy">
            <p className="location-line"><MapPin size={15} aria-hidden="true" />{t("Banting, Selangor")}</p>
            <h1>{t("A better way to find your next car.")}</h1>
            <p>{t("Explore the cars we feature, ask what you need to know, and plan a visit to our Banting showroom.")}</p>
            <div className="hero-actions"><button className="button button--primary" onClick={() => goToPage('cars')}>{t("Explore featured cars")} <ArrowRight size={17} aria-hidden="true" /></button><button className="button button--plain" onClick={() => goToPage('contact')}>{t("Talk to the team")}</button></div>
            <div className="lot-note"><span className="lot-note-rule" />{t("Local dealership · Direct contact · Carlist inventory")}</div>
          </div>
          <div className="hero-art hero-lot-photo"><img src={showroom} alt={t("Seng Guan Auto's roadside showroom in Banting")} width="1072" height="603" fetchPriority="high" /></div>
        </section>
      )
    case 'drive-finder':
      return (
        <section className="hero hero--finder">
          <div className="finder-image"><img src={budgetCar.photo} alt={`${budgetCar.year} ${budgetCar.name}`} width="300" height="200" fetchPriority="high" /></div>
          <div className="finder-content hero-copy">
            <p className="hero-overline">{t("Seng Guan Auto · Used cars")}</p>
            <h1>{t("Find a car that feels right.")}</h1>
            <p>{t("Start with the body style or make you have in mind. Check live details on our Carlist page.")}</p>
            <div className="finder-actions">
              <button className="button button--primary" onClick={() => goToPage('cars')}><Search size={17} aria-hidden="true" />{t("Browse featured cars")}</button>
              <button className="button button--soft" onClick={() => goToPage('finance')}><Calculator size={17} aria-hidden="true" />{t("Estimate a payment")}</button>
            </div>
          </div>
          <div className="finder-footer"><span>{t("Cars for everyday drives")}</span><span>{t("Information first, conversation next")}</span></div>
        </section>
      )
    case 'night-shift':
      return (
        <section className="hero hero--night">
          <div className="night-copy hero-copy">
            <p className="night-kicker"><span />{t("Banting, Selangor")}</p>
            <h1>{t("Find your next")}<br /><em>{t("open road.")}</em></h1>
            <p>{t("Good cars deserve a closer look. Browse the featured selection and ask us about the details.")}</p>
            <div className="hero-actions"><button className="button button--accent" onClick={() => goToPage('cars')}>{t("Explore the lot")} <ArrowDownRight size={17} aria-hidden="true" /></button><button className="button button--outline-light" onClick={() => goToPage('contact')}>{t("Plan a visit")}</button></div>
            <span className="night-number">SG / AUTO</span>
          </div>
          <div className="hero-art night-art"><img src={primaryCar.photo} alt={`${primaryCar.year} ${primaryCar.name}`} width="300" height="200" fetchPriority="high" /><span className="night-art-caption">{t("Featured drive / BMW 530i")}</span></div>
          <div className="night-edge" aria-hidden="true">SENG GUAN AUTO</div>
        </section>
      )
    case 'everyday-miles':
      return (
        <section className="hero hero--everyday">
          <div className="everyday-visual hero-art"><img src={vehicles[3].photo} alt={`${vehicles[3].year} ${vehicles[3].name}`} width="300" height="200" fetchPriority="high" /><div className="everyday-caption"><span>{t("Room for the whole day")}</span><span>{t("Ask about the Vellfire")}</span></div></div>
          <div className="everyday-copy hero-copy">
            <p className="hero-overline">{t("A local car search, made personal")}</p>
            <h1>{t("More room for the life you lead.")}</h1>
            <p>{t("Compare a few options, work out a comfortable budget, then speak with the team about the car that caught your eye.")}</p>
            <div className="everyday-links"><button onClick={() => goToPage('cars')}><CarFront aria-hidden="true" />{t("Browse cars")}</button><button onClick={() => goToPage('finance')}><Calculator aria-hidden="true" />{t("Plan a payment")}</button><button onClick={() => goToPage('contact')}><MapPin aria-hidden="true" />{t("Visit Banting")}</button></div>
          </div>
        </section>
      )
    case 'the-collection':
      return (
        <section className="hero hero--collection">
          <img className="collection-image hero-art" src={primaryCar.photo} alt={`${primaryCar.year} ${primaryCar.name}`} width="300" height="200" fetchPriority="high" />
          <div className="collection-copy hero-copy">
            <p className="collection-label">Seng Guan Auto / Banting</p>
            <h1>{t("Good cars.")}<br />{t("A closer look.")}</h1>
            <p>{t("A small selection to start your search. Find the live details on Carlist or ask us about a visit.")}</p>
            <button className="button button--light" onClick={() => goToPage('cars')}>{t("View the selection")} <ArrowUpRight size={17} aria-hidden="true" /></button>
          </div>
          <div className="collection-stamp">S G<br /><span>{t("USED CARS")}</span></div>
        </section>
      )
    case 'spec-ledger':
      return (
        <section className="hero hero--ledger">
          <div className="ledger-top hero-copy"><div><p className="ledger-label">{t("Seng Guan Auto / Used vehicles")}</p><h1>{t("Start with what matters.")}</h1></div><p>{t("Filter the featured selection, review the basics, then check current price and availability on Carlist.")}</p></div>
          <div className="ledger-feature hero-art"><img src={budgetCar.photo} alt={`${budgetCar.year} ${budgetCar.name}`} width="300" height="200" fetchPriority="high" /><div className="ledger-specs"><span>{t("Featured")}</span><strong>{budgetCar.year} {budgetCar.name}</strong><span>{t("Petrol")} <i />{t("Automatic")}</span></div><button className="button button--primary" onClick={() => goToPage('cars')}>{t("Open vehicle index")} <ArrowRight size={16} aria-hidden="true" /></button></div>
          <div className="ledger-bottom"><span>{t("Used cars")}</span><span>{t("Carlist for live details")}</span><span>{t("Questions welcome")}</span></div>
        </section>
      )
    case 'drive-journal':
      return (
        <section className="hero hero--journal">
          <div className="journal-masthead"><span>{t("THE SENG GUAN JOURNAL")}</span><span>{t("BANTING · SELANGOR")}</span></div>
          <div className="journal-grid">
            <div className="journal-copy hero-copy"><p className="journal-date">{t("The showroom, this week")}</p><h1>{t("Every car has a story. Start with yours.")}</h1><p>{t("Browse a few of the vehicles featured on our site, then explore each car’s photos and details.")}</p><button className="button button--primary" onClick={() => goToPage('cars')}>{t("Turn the first page")} <ArrowRight size={17} aria-hidden="true" /></button></div>
            <div className="journal-photo hero-art"><img src={showroom} alt={t("Seng Guan Auto showroom frontage in Banting")} width="1072" height="603" fetchPriority="high" /><span>Lot 712 · Batu 18 · Banting</span></div>
          </div>
          <div className="journal-foot"><span>{t("Cars, people, and the road ahead")}</span><span>{t("Read the buying guide")} <ArrowDownRight size={15} aria-hidden="true" /></span></div>
        </section>
      )
    case 'open-lot':
      return (
        <section className="hero hero--open-lot">
          <div className="open-lot-header"><span>SENG GUAN AUTO</span><span>{t("USED CARS / BANTING")}</span></div>
          <div className="open-lot-title hero-copy"><h1>{t("OPEN")}<br /><span>{t("LOT")}</span></h1><div><p>{t("Look through the current homepage selection. For prices and availability, go straight to the live dealer listings.")}</p><button className="button button--primary" onClick={() => goToPage('cars')}>{t("Browse vehicles")} <ArrowRight size={17} aria-hidden="true" /></button></div></div>
          <div className="open-lot-photo hero-art"><img src={vehicles[0].photo} alt={`${vehicles[0].year} ${vehicles[0].name}`} width="300" height="200" fetchPriority="high" /><span>{t("Featured vehicle /")} {vehicles[0].year}</span></div>
          <div className="open-lot-tape"><span>{t("Find")}</span><span>{t("Ask")}</span><span>{t("Visit")}</span></div>
        </section>
      )
    case 'monthly-key':
      return (
        <section className="hero hero--monthly">
          <div className="monthly-copy hero-copy"><p className="hero-overline">{t("Take the next step at your own pace")}</p><h1>{t("Could this car fit your month?")}</h1><p>{t("Try a private, browser-only estimate. Your numbers stay on this device and are not sent anywhere.")}</p><div className="monthly-actions"><button className="button button--primary" onClick={() => goToPage('finance')}><Calculator size={17} aria-hidden="true" />{t("Open calculator")}</button><button className="button button--plain" onClick={() => goToPage('cars')}>{t("Browse cars")}</button></div></div>
          <div className="monthly-visual hero-art"><img src={budgetCar.photo} alt={`${budgetCar.year} ${budgetCar.name}`} width="300" height="200" fetchPriority="high" /><div className="monthly-sticker"><span>{t("Estimate only")}</span><strong>{t("RM / month")}</strong><small>{t("Set your own inputs")}</small></div></div>
        </section>
      )
    case 'greenlight':
      return (
        <section className="hero hero--showroom">
          <ShowroomHeroImage />
          <div className="showroom-copy hero-copy">
            <p className="showroom-kicker"><span>{t("Used cars")}</span><i aria-hidden="true" />{t("Banting, Selangor")}</p>
            <h1>{t("Your next car.")}<br /><span>{t("Right here.")}</span></h1>
            <p>{t("Explore the featured selection from Seng Guan Auto. View vehicle photos and details, or ask our team about current availability.")}</p>
            <div className="hero-actions showroom-actions"><button className="button button--primary" onClick={() => goToPage('cars')}>{t("Browse vehicles")} <ArrowRight size={17} aria-hidden="true" /></button><button className="button button--outline-light" onClick={() => goToPage('finance')}><Calculator size={17} aria-hidden="true" />{t("Loan calculator")}</button></div>
          </div>
        </section>
      )
    default:
      return (
        <section className="hero hero--clear">
          <div className="clear-top"><div className="hero-copy"><p className="hero-overline">Seng Guan Auto · Banting</p><h1>{t("Used cars, with room to think.")}</h1></div><p>{t("Browse a selection, check live details on Carlist, and contact the team when you are ready.")}</p></div>
          <div className="clear-image hero-art"><img src={vehicles[5].photo} alt={`${vehicles[5].year} ${vehicles[5].name}`} width="300" height="200" fetchPriority="high" /><button className="button button--primary" onClick={() => goToPage('cars')}>{t("See featured cars")} <ArrowRight size={16} aria-hidden="true" /></button></div>
          <div className="clear-bottom"><span>{t("01 / Browse")}</span><span>{t("02 / Compare")}</span><span>{t("03 / Ask")}</span></div>
        </section>
      )
  }
}

function VehicleTeaser({ variantId, goToPage }: { variantId: string; goToPage: (page: PageId) => void }) {
  const { t } = useLocale()
  return (
    <section className="section section-vehicles">
      {variantId === 'greenlight' ? (
        <div className="featured-showcase">
          <div className="featured-showcase-copy">
            <p className="section-label">{t("A few to get you started")}</p>
            <h2>{t("Featured vehicles")}</h2>
            <p>{t("Start with a few cars from the Seng Guan Auto homepage selection.")}</p>
            <button className="text-link" onClick={() => goToPage('cars')}>{t("See all featured cars")} <ArrowRight size={17} aria-hidden="true" /></button>
          </div>
          <FeaturedVehicleDisplay onBrowse={() => goToPage('cars')} />
        </div>
      ) : (
        <div className="section-heading"><div><p className="section-label">{t("A few to get you started")}</p><h2>{t("Featured vehicles")}</h2></div><button className="text-link" onClick={() => goToPage('cars')}>{t("See all featured cars")} <ArrowRight size={17} aria-hidden="true" /></button></div>
      )}
      <p className="data-note">{t("Explore vehicle photos and details on our website. You can also find us on")} <a href={contact.inventory} target="_blank" rel="noreferrer">Carlist</a>.</p>
    </section>
  )
}

function VehicleMake({make}: {make:string}) {
  const label=useRef<HTMLSpanElement>(null)
  useLayoutEffect(()=>{
    const node=label.current
    if(!node)return
    const mobile=window.matchMedia('(max-width: 760px)')
    let active=true
    const fit=()=>{
      if(!active)return
      node.style.removeProperty('font-size')
      if(!mobile.matches || !node.closest('.inventory-grid:not(.inventory-grid--photo)') || !node.clientWidth)return
      const initial=parseFloat(getComputedStyle(node).fontSize)
      for(let size=initial;size>10 && node.scrollWidth>node.clientWidth;size=Math.max(10,size-0.5))node.style.fontSize=`${Math.max(10,size-0.5)}px`
    }
    const observer=new ResizeObserver(fit)
    observer.observe(node)
    mobile.addEventListener('change',fit)
    fit()
    void document.fonts.ready.then(fit)
    return ()=>{active=false;observer.disconnect();mobile.removeEventListener('change',fit)}
  },[make])
  return <span ref={label} className="vehicle-make" title={make}>{make}</span>
}

function VehicleCard({ car, index=0 }: { car: Vehicle; index?:number }) {
  const { t, locale } = useLocale()
  const [opened, setOpened] = useState(false)
  const [copied, setCopied] = useState(false)
  const [calculatorOpen, setCalculatorOpen] = useState(false)
  const href = isOfficialSite ? `/cars?vehicle=${encodeURIComponent(String(car.id))}` : contact.inventory
  const calculatorPrice = getVehicleDiscount(car.price,car.discount_price) ? car.discount_price : car.price
  const available = car.status === 'available'
  const unavailableStatus = car.status === 'sold' || car.status === 'reserved' ? car.status : null
  const stamp = unavailableStatus ? t(unavailableStatus === 'sold' ? 'SOLD' : 'RESERVED') : null
  const availableLabel = useRef<HTMLSpanElement>(null)
  const openVehicle = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!isPlainLeftClick(event) || (!isOfficialSite && !car.photos)) return
    event.preventDefault()
    setOpened(true)
  }

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2200)
    return () => window.clearTimeout(timer)
  }, [copied])

  useEffect(() => {
    const label = availableLabel.current
    if (!label) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      label.dataset.pulse = 'true'
      observer.disconnect()
    })
    observer.observe(label)
    return () => observer.disconnect()
  }, [available])

  const shareVehicle = async () => {
    const url = new URL(href, window.location.href).href
    if (navigator.share) {
      try {
        await navigator.share({ title: car.name, url })
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      window.prompt(t('Copy this vehicle link'), url)
    }
  }

  return (
    <article className="vehicle-card vehicle-entrance" style={entranceStyle(index)}>
      <div className="vehicle-card-link">
        <div className="vehicle-media">
          <div className="vehicle-photo">
            <ProgressiveImage src={car.photo} alt="" width="300" height="200" priority={index < 3} />
            {stamp && <span className={`vehicle-status vehicle-status--${car.status}`}>{stamp}</span>}
            {isOfficialSite && <span className="vehicle-photo-count" aria-label={t('{count} 张照片',{count:car.photos?.length ?? (car.photo ? 1 : 0)})}><ImageIcon size={15} aria-hidden="true" />{car.photos?.length ?? (car.photo ? 1 : 0)}</span>}
          </div>
          {(available || stamp) && <span className={`vehicle-status-bar${available ? ' vehicle-status-bar--available' : ''}`}>
            {available ? <span ref={availableLabel}>{t('AVAILABLE')}</span> : t('NOT AVAILABLE')}
          </span>}
        </div>
        <div className="vehicle-info">
          {isOfficialSite && car.status && car.status !== 'draft' && <span className={`vehicle-info-status vehicle-info-status--${car.status}`}>
            <span>{t(car.status === 'available' ? 'AVAILABLE' : 'NOT AVAILABLE')}</span>
          </span>}
          <div className="vehicle-info-header"><VehicleMake make={car.make} />{isOfficialSite && <div className="vehicle-actions"><button type="button" className="vehicle-calculator" onClick={()=>setCalculatorOpen(true)} aria-label={t('Loan calculator for {name}',{name:car.name})} title={t('Loan calculator')}><Calculator size={20} aria-hidden="true" /></button><button type="button" className="vehicle-share" onClick={() => void shareVehicle()} aria-label={t('Share {name}', {name:car.name})}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 10.5 14 5v3C8 8.8 4 12.3 2.5 19c3.4-4.3 7.1-6.3 11.5-6.3v3.3l8-5.5Z" /></svg>
          </button><span className="vehicle-share-status" role="status">{copied ? t('Link copied') : ''}</span></div>}</div>
          <div className="vehicle-title"><h3>{car.name}</h3></div>
          <VehicleSpecs car={car} />
          {car.price != null && (() => {
            const discount = getVehicleDiscount(car.price,car.discount_price)
            return discount ? <div className="vehicle-pricing">
              <del className="vehicle-price-original">RM {car.price!.toLocaleString(locale)}</del>
              <p className="vehicle-price">RM {car.discount_price!.toLocaleString(locale)}</p>
              <span className="vehicle-price-drop">-{discount.percent}% {t('Price drop!')}</span>
            </div> : <p className="vehicle-price">RM {car.price.toLocaleString(locale)}</p>
          })()}
          <VehicleListingDate car={car} />
        </div>
      </div>
      <a className="vehicle-card-cover" href={href} onClick={openVehicle} target="_blank" rel="noreferrer" aria-label={t(unavailableStatus ? 'Check availability for {year} {name}' : 'View photos and details for {year} {name}', { year: car.year, name: car.name })} />
      {calculatorOpen && <LoanCalculatorDialog initialPrice={calculatorPrice} onClose={()=>setCalculatorOpen(false)} />}
      {opened && (unavailableStatus
        ? <VehicleUnavailable status={unavailableStatus} onClose={() => setOpened(false)} />
        : <VehicleDetails car={car} onClose={() => setOpened(false)} onCalculator={isOfficialSite ? ()=>setCalculatorOpen(true) : undefined} onShare={isOfficialSite ? ()=>void shareVehicle() : undefined} copied={copied} />)}
    </article>
  )
}

function FinanceTeaser({ goToPage }: { goToPage: (page: PageId) => void }) {
  const { t } = useLocale()
  return (
    <section className="section finance-teaser">
      <div className="finance-teaser-copy"><p className="section-label">{t("Plan before you visit")}</p><h2>{t("Put your own numbers into the picture.")}</h2><p>{t("Estimate a monthly payment with an on-page calculator. Your inputs stay in your browser.")}</p><button className="button button--primary" onClick={() => goToPage('finance')}>{t("Try the calculator")} <ArrowRight size={17} aria-hidden="true" /></button></div>
      <div className="finance-teaser-art"><div className="finance-paper"><span>{t("CAR PRICE")}</span><strong>RM —</strong><span>{t("DOWN PAYMENT")}</span><strong>RM —</strong><hr /><span>{t("MONTHLY ESTIMATE")}</span><strong className="estimate-value">RM —</strong></div><span className="estimate-note">{t("Illustration only · no information submitted")}</span></div>
    </section>
  )
}

function StoryTeaser({ variant, goToPage }: { variant: Direction; goToPage: (page: PageId) => void }) {
  const { t } = useLocale()
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(contact.address)}&navigate=yes`
  return (
    <section className={`section story-teaser${variant.id === 'night-shift' ? ' nightshift-proof' : ''}`}>
      <div className="story-photo"><ProgressiveImage src={showroom} preview={showroomPreview} alt={t("Seng Guan Auto's dealership in Banting")} width="1072" height="603" /></div>
      <div className="story-copy"><p className="section-label">{t("The place behind the name")}</p><h2>{t("Find us in Banting.")}</h2><p>{t("Visit Seng Guan Auto at Lot 712, Batu 18, Jln Klang Banting. Browse the current listings first, then contact the team if you would like to see a vehicle.")}</p>
        {variant.id === 'greenlight' ? (
          <div className="story-directions">
            <a className="button button--plain story-direction-link story-direction-link--maps" href={googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={17} aria-hidden="true" /> Google Maps</a>
            <a className="button button--plain story-direction-link story-direction-link--waze" href={wazeUrl} target="_blank" rel="noreferrer"><Navigation size={17} aria-hidden="true" /> Waze</a>
          </div>
        ) : (
          <button className="text-link" onClick={() => goToPage('about')}>{t("About the dealership")} <ArrowRight size={17} aria-hidden="true" /></button>
        )}
      </div>
    </section>
  )
}



function VisitTeaser({ goToPage }: { goToPage: (page: PageId) => void }) {
  const { t } = useLocale()
  return (
    <section className="section visit-teaser">
      <div><p className="section-label">{t("A conversation starts here")}</p><h2>{t("Have a car in mind?")}</h2><p>{t("Ask about a vehicle, arrange a visit, or talk through the next step with the Seng Guan Auto team.")}</p></div>
      <div className="visit-actions"><a className="button button--whatsapp" href={contact.whatsapp} target="_blank" rel="noreferrer"><WhatsAppGlyph />{t("Ask on WhatsApp")}</a><button className="button button--plain" onClick={() => goToPage('contact')}>{t("Contact details")}</button></div>
    </section>
  )
}

function FaqTeaser({ goToPage }: { goToPage: (page: PageId) => void }) {
  const { t } = useLocale()
  return (
    <section className="section faq-teaser">
      <div><p className="section-label">{t("The buying questions")}</p><h2>{t("Know what to ask.")}</h2></div>
      <div className="faq-teaser-questions"><p>{t("Can I arrange a test drive?")}</p><p>{t("What should I ask about financing?")}</p><p>{t("Where can I see current prices?")}</p><button className="text-link" onClick={() => goToPage('faq')}>{t("Read the FAQs")} <ArrowRight size={17} aria-hidden="true" /></button></div>
    </section>
  )
}

function InventoryPage({ variant }: { variant: Direction }) {
  const { t, locale } = useLocale()
  const vehicles = useVehicles()
  const [search, setSearch] = useState('')
  const [make, setMake] = useState('')
  const [year, setYear] = useState('')
  const [bodyType, setBodyType] = useState('')
  const priceLimit = 1_000_000
  const [priceRange, setPriceRange] = useState([0,priceLimit])
  const [minPrice,maxPrice] = priceRange
  const [sort, setSort] = useState<'published' | 'year' | 'price'>('published')
  const [ascending, setAscending] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [layoutChoice, setLayoutChoice] = useState<boolean | null>(null)
  const [wideLayout, setWideLayout] = useState(() => !window.matchMedia('(max-width: 760px)').matches)
  const photoLayout = layoutChoice ?? wideLayout
  useEffect(() => {
    const narrow = window.matchMedia('(max-width: 760px)')
    const updateLayout = () => setWideLayout(!narrow.matches)
    narrow.addEventListener('change', updateLayout)
    return () => narrow.removeEventListener('change', updateLayout)
  }, [])
  const filterPanel = useRef<HTMLDivElement>(null)
  const filterToggle = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!advancedOpen) return
    const closeOutside = (event: Event) => {
      const target = event.target
      if (!(target instanceof Node) || filterPanel.current?.contains(target) || filterToggle.current?.contains(target)) return
      setAdvancedOpen(false)
    }
    document.addEventListener('click', closeOutside, true)
    return () => document.removeEventListener('click', closeOutside, true)
  }, [advancedOpen])
  const pageQuery = new URLSearchParams({sort,direction:ascending?'asc':'desc'})
  if(search.trim())pageQuery.set('q',search.trim())
  const translatedBody=['Sedan','SUV','MPV','Hatchback','Pickup','Coupe','Van','Wagon','Other'].find(body=>t(body).toLowerCase()===search.trim().toLowerCase() && t(body).toLowerCase()!==body.toLowerCase())
  if(translatedBody)pageQuery.set('bodyAlias',translatedBody)
  if(make)pageQuery.set('make',make)
  if(year)pageQuery.set('year',year)
  if(bodyType)pageQuery.set('body',bodyType)
  if(minPrice>0)pageQuery.set('minPrice',String(minPrice))
  if(maxPrice<priceLimit)pageQuery.set('maxPrice',String(maxPrice))
  const pages = useVehiclePages<Vehicle>(pageQuery.toString(),async (query,signal)=>{
    const response=await fetch('/api/vehicles?'+query,{signal})
    if(!response.ok)throw Error('Unable to load vehicles.')
    const page=await response.json()
    return {...page,vehicles:page.vehicles.map((v:Vehicle)=>({...v,year:String(v.year)}))}
  },isOfficialSite)
  const allFacets = isOfficialSite ? pages.facets : vehicles
  const makes = vehicleMakeOptions(allFacets.map(car => car.make))
  const years = Array.from(new Set(allFacets.map(car => String(car.year)))).sort((a, b) => Number(b) - Number(a))
  const bodyTypes = [...new Set(allFacets.map(car => car.body).filter(Boolean))].sort((a,b) => t(a).localeCompare(t(b)))
  const activeFilters = [make,year,bodyType,minPrice > 0,maxPrice < priceLimit].filter(Boolean).length
  const formatPrice = (value: number) => `RM ${value.toLocaleString(locale)}`
  const resetFilters = () => {
    setSearch('')
    setMake('')
    setYear('')
    setBodyType('')
    setPriceRange([0,priceLimit])
  }
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    const sortValue = (car: Vehicle) => {
      if (sort === 'price') return car.price ?? null
      if (sort === 'year') return Number(car.year)
      return car.published_at ? Date.parse(car.published_at) : null
    }
    return vehicles.filter(car => {
      if (make && vehicleMakeKey(car.make) !== make || year && String(car.year) !== year) return false
      if (bodyType && car.body !== bodyType) return false
      if (minPrice > 0 && (car.price == null || car.price < minPrice)) return false
      if (maxPrice < priceLimit && (car.price == null || car.price > maxPrice)) return false
      return `${car.make} ${car.year} ${car.name} ${car.body} ${t(car.body)}`.toLowerCase().includes(query)
    }).sort((a, b) => {
      const first = sortValue(a)
      const second = sortValue(b)
      if (first === null) return second === null ? 0 : 1
      if (second === null) return -1
      return ascending ? first - second : second - first
    })
  }, [make, year, bodyType, minPrice, maxPrice, search, sort, ascending, vehicles, t])

  const results = isOfficialSite ? pages.items : filtered
  const [linkedVehicle,setLinkedVehicle]=useState<Vehicle|null>(null)
  const [linkedCalculator,setLinkedCalculator]=useState(false)
  const [linkedCopied,setLinkedCopied]=useState(false)
  useEffect(()=>{
    if(!isOfficialSite)return
    const id=new URLSearchParams(window.location.search).get('vehicle')
    if(!id)return
    const controller=new AbortController()
    void fetch(`/api/vehicles/${encodeURIComponent(id)}`,{signal:controller.signal}).then(response=>response.ok?response.json():null).then(car=>{if(car)setLinkedVehicle({...car,year:String(car.year)})}).catch(()=>{})
    return()=>controller.abort()
  },[])

  return (
    <div className={`content-page content-page--cars content-page--${variant.id}`}>
      <PageIntro eyebrow={t("The featured selection")} title={t("Find a car to look closer at.")} description={t("Explore our vehicles, view all photos and specifications, and ask our team about the car you like.")} />
      <section className="inventory-browser" aria-label={t("Featured vehicle browser")}>
        <div className="inventory-tools">
          <div className="inventory-search-row" onKeyDown={event => {
            if (event.key === 'Escape' && advancedOpen) {
              event.stopPropagation()
              setAdvancedOpen(false)
              filterToggle.current?.focus()
            }
          }}>
            <label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">{t("Search featured vehicles")}</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("Search make or model…")} type="search" /></label>
            <button ref={filterToggle} type="button" className="button button--plain inventory-advanced-toggle"
              aria-expanded={advancedOpen} aria-controls="inventory-refine" onClick={() => setAdvancedOpen(open => !open)}>
              <span>{t('Advanced search')}</span>
              {activeFilters > 0 && <span className="inventory-filter-count">{activeFilters}</span>}
              <ChevronDown size={12} aria-hidden="true" />
            </button>
            <div ref={filterPanel} id="inventory-refine" className="inventory-refine" hidden={!advancedOpen}>
              <label><span id="inventory-make-label">{t("Filter by make")}</span>
                <select aria-labelledby="inventory-make-label" value={make} onChange={event => setMake(event.target.value)}>
                  <option value="">{t("All makes")}</option>
                  {makes.map(([key,option]) => <option key={key} value={key}>{option}</option>)}
                </select>
              </label>
              <label><span id="inventory-year-label">{t("Manufactured year")}</span>
                <select aria-labelledby="inventory-year-label" value={year} onChange={event => setYear(event.target.value)}>
                  <option value="">{t("All years")}</option>
                  {years.map(option => <option key={option}>{option}</option>)}
                </select>
              </label>
              <label><span id="inventory-body-label">{t('车身类型')}</span>
                <select aria-labelledby="inventory-body-label" value={bodyType} onChange={event => setBodyType(event.target.value)}>
                  <option value="">{t('All body types')}</option>
                  {bodyTypes.map(option => <option key={option} value={option}>{t(option)}</option>)}
                </select>
              </label>
              <div className="inventory-price-filter">
                <span id="inventory-price-label">{t("Price range")}</span>
                <Slider.Root className="inventory-price-slider" role="group" aria-labelledby="inventory-price-label"
                  min={0} max={priceLimit} step={10_000} value={priceRange} onValueChange={setPriceRange}>
                  <Slider.Track className="inventory-price-track"><Slider.Range className="inventory-price-range" /></Slider.Track>
                  <Slider.Thumb className="inventory-price-thumb" aria-label={t("Min. price (RM)")} aria-valuetext={formatPrice(minPrice)} />
                  <Slider.Thumb className="inventory-price-thumb" aria-label={t("Max. price (RM)")} aria-valuetext={formatPrice(maxPrice)} />
                </Slider.Root>
                <div className="inventory-price-values" aria-hidden="true">
                  <span>{formatPrice(minPrice)}</span>
                  <span>{formatPrice(maxPrice)}</span>
                </div>
              </div>
              <button className="button button--plain inventory-reset" type="button" onClick={resetFilters}>{t("Clear All")}</button>
            </div>
          </div>
          <div className="inventory-view-row">
            <div className="inventory-sort">
              <label><span id="inventory-sort-label">{t("Sort by")}</span>
                <span className="inventory-sort-select">
                  <select aria-labelledby="inventory-sort-label" value={sort} onChange={event => {
                    const value = event.target.value
                    if (value === 'published' || value === 'year' || value === 'price') setSort(value)
                  }}>
                    <option value="published">{t("Published date")}</option>
                    <option value="year">{t("Manufactured year")}</option>
                    <option value="price">{t("Selling price")}</option>
                  </select>
                  <ChevronDown size={14} aria-hidden="true" />
                </span>
              </label>
              <button className="button button--plain inventory-sort-direction" type="button"
                aria-label={t("Ascending order")} aria-pressed={ascending}
                title={t(ascending ? "Ascending order" : "Descending order")}
                onClick={() => setAscending(value => !value)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d={ascending
                    ? 'M3 6h4m-4 4h7m-7 4h10m-10 4h13m4 0V6m-3 3 3-3 3 3'
                    : 'M3 6h13m-13 4h10m-10 4h7m-7 4h4m13-12v12m-3-3 3 3 3-3'} />
                </svg>
              </button>
            </div>
            <div className="inventory-layout-switch" role="group" aria-label={t("Vehicle layout")} data-photo={photoLayout}>
              <button type="button" aria-label={t("Standard layout")} title={t("Standard layout")}
                aria-pressed={!photoLayout} onClick={() => setLayoutChoice(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14m3-10h3m-3 4h3" />
                </svg>
              </button>
              <button type="button" aria-label={t("Large photo layout")} title={t("Large photo layout")}
                aria-pressed={photoLayout} onClick={() => setLayoutChoice(true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
                  <rect x="4" y="3" width="16" height="18" rx="2" /><path d="M4 13h16m-12 4h8" />
                </svg>
              </button>
            </div>
          </div>
          {(search || activeFilters > 0) && <button className="text-link inventory-reset" type="button" onClick={resetFilters}>{t("Reset filters")}</button>}
        </div>
        <ListingTransition loading={pages.loading && !results.length && isOfficialSite} compact={!photoLayout}>
          {results.length ? <div className={`inventory-grid${photoLayout ? ' inventory-grid--photo' : ''}`}>{results.map((car,index) => <VehicleCard key={car.id} car={car} index={index} />)}</div> : <div className="empty-state"><CarFront size={25} aria-hidden="true" /><h2>{t(pages.error ? 'Unable to load vehicles right now.' : 'No vehicles match that search.')}</h2><p>{t(pages.error ? 'Please refresh the page or contact our team.' : 'Try another search or adjust your filters.')}</p></div>}
        </ListingTransition>
        {isOfficialSite && <LoadMore sentinel={pages.sentinel} loading={pages.loading} hasMore={pages.hasMore} error={pages.error} retry={pages.reload} />}
        <p className="data-note">{t("Featured selection.")} <a href={contact.inventory} target="_blank" rel="noreferrer">{t("More listings on Carlist")} <ArrowUpRight size={13} aria-hidden="true" /></a></p>
      </section>
      {linkedVehicle && (linkedVehicle.status==='sold'||linkedVehicle.status==='reserved'
        ? <VehicleUnavailable status={linkedVehicle.status} onClose={()=>setLinkedVehicle(null)} />
        : <VehicleDetails car={linkedVehicle} onClose={()=>setLinkedVehicle(null)} onCalculator={()=>setLinkedCalculator(true)} copied={linkedCopied} onShare={()=>{
          const url=window.location.href
          if(navigator.share){void navigator.share({title:linkedVehicle.name,url}).catch(()=>{});return}
          void navigator.clipboard.writeText(url).then(()=>setLinkedCopied(true)).catch(()=>window.prompt(t('Copy this vehicle link'),url))
        }} />)}
      {linkedVehicle && linkedCalculator && <LoanCalculatorDialog initialPrice={getVehicleDiscount(linkedVehicle.price,linkedVehicle.discount_price) ? linkedVehicle.discount_price : linkedVehicle.price} onClose={()=>setLinkedCalculator(false)} />}
    </div>
  )
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-intro"><p className="section-label">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>
}

function LoanCalculatorPanel({initialValue}: {initialValue?:number|null}) {
  const { t, locale } = useLocale()
  const [price, setPrice] = useState(() => initialValue === undefined ? '80000' : initialValue == null ? '' : String(initialValue))
  const [down, setDown] = useState(() => initialValue === undefined ? '8000' : initialValue == null ? '' : String(Math.round(initialValue * .1)))
  const [rate, setRate] = useState('3.5')
  const [years, setYears] = useState('7')
  const [calculated, setCalculated] = useState(false)
  const [error, setError] = useState('')
  const amount = Number(price)
  const downAmount = Number(down)
  const annualRate = Number(rate) / 100
  const term = Number(years)
  const loan = amount - downAmount
  const monthly = (loan + loan * annualRate * term) / (term * 12)
  const formatMoney = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n)

  const calculate = () => {
    setError('')
    if (![amount, downAmount, annualRate, term].every(Number.isFinite) || amount <= 0 || downAmount < 0 || downAmount >= amount || annualRate < 0 || term <= 0 || term > 9) {
      setCalculated(false)
      setError('Check your inputs: enter a price, a smaller down payment, a non-negative rate, and a term from 1 to 9 years.')
      return
    }
    setCalculated(true)
  }

  return <div className="calculator-panel">
          <div className="calculator-heading"><div><p className="section-label">{t("Loan calculator")}</p><h2>{t("Your estimate")}</h2></div><Calculator size={24} aria-hidden="true" /></div>
          <div className="calculator-fields">
            <label>{t("Car price")} <span>RM</span><input name="car-price" inputMode="decimal" type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
            <label>{t("Down payment")} <span>RM</span><input name="down-payment" inputMode="decimal" type="number" min="0" value={down} onChange={(event) => setDown(event.target.value)} /></label>
            <label>{t("Interest rate")} <span>{t("% per year")}</span><input name="interest-rate" inputMode="decimal" type="number" min="0" step="0.1" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
            <label>{t("Loan term")} <span>{t("Years · up to 9")}</span><input name="loan-term" inputMode="numeric" type="number" min="1" max="9" value={years} onChange={(event) => setYears(event.target.value)} /></label>
          </div>
          <button className="button button--primary calculate-button" type="button" onClick={calculate}>{t("Calculate estimate")} <ArrowRight size={17} aria-hidden="true" /></button>
          {error && <p className="field-error" role="alert">{t(error)}</p>}
          {calculated && <div className="estimate-result" aria-live="polite"><span>{t("Estimated monthly payment")}</span><strong>{formatMoney(monthly)}</strong><p>{t('Estimated loan amount: {amount} · {term} years', { amount: formatMoney(loan), term })}</p></div>}
          <p className="calculator-disclaimer">{t("Illustrative flat-rate calculation only. Actual rates, eligibility, fees, and terms vary. Your inputs stay in this browser and are not submitted.")}</p>
        </div>
}

function LoanCalculatorDialog({initialPrice,onClose}: {initialPrice:number|null|undefined;onClose:()=>void}) {
  const {t}=useLocale()
  const dialog=useRef<HTMLDialogElement>(null)
  useEffect(()=>{
    const previous=document.documentElement.style.overflow
    const previousScrollBehavior=document.documentElement.style.scrollBehavior
    document.documentElement.style.overflow='hidden'
    document.documentElement.style.scrollBehavior='auto'
    dialog.current?.showModal()
    return ()=>{dialog.current?.close();document.documentElement.style.overflow=previous;document.documentElement.style.scrollBehavior=previousScrollBehavior}
  },[])
  return <dialog ref={dialog} autoFocus className="vehicle-dialog loan-calculator-dialog" aria-label={t('Loan calculator')} onCancel={event=>{event.preventDefault();onClose()}}>
    <button type="button" className="vehicle-dialog-close" onClick={onClose} aria-label={t('Close')}><X /></button>
    <LoanCalculatorPanel initialValue={initialPrice ?? null} />
  </dialog>
}

function FinancePage({ variant }: { variant: Direction }) {
  const {t}=useLocale()
  const initialPrice = new URLSearchParams(window.location.search).get('price')
  const initialValue = initialPrice === null ? undefined : initialPrice.trim() !== '' && Number.isFinite(Number(initialPrice)) && Number(initialPrice)>0 ? Number(initialPrice) : null
  return (
    <div className={`content-page content-page--finance content-page--${variant.id}`}>
      <PageIntro eyebrow={t("A browser-only estimate")} title={t("Plan a payment that works for you.")} description={t("Change the example values, calculate a simple estimate, and discuss actual terms with a finance provider.")} />
      <section className="calculator-layout">
        <LoanCalculatorPanel initialValue={initialValue} />
        <aside className="finance-aside"><div className="finance-aside-icon"><CircleHelp size={22} aria-hidden="true" /></div><h2>{t("What should I compare?")}</h2><ul><li>{t("Monthly payment and total repayment")}</li><li>{t("Down payment and loan length")}</li><li>{t("Provider terms and any additional fees")}</li><li>{t("Vehicle price and live availability")}</li></ul><a className="text-link" href={contact.whatsapp} target="_blank" rel="noreferrer">{t("Ask the team about financing")} <ArrowUpRight size={15} aria-hidden="true" /></a></aside>
      </section>
      <section className="finance-next"><div><p className="section-label">{t("Keep your options open")}</p><h2>{t("Compare the car and the payment together.")}</h2></div><a className="button button--primary" href={contact.inventory} target="_blank" rel="noreferrer">{t("Browse current listings")} <ArrowUpRight size={16} aria-hidden="true" /></a></section>
    </div>
  )
}

function AboutPage({ variant, goToPage }: { variant: Direction; goToPage: (page: PageId) => void }) {
  const { t } = useLocale()
  const aboutRef = useRef<HTMLDivElement>(null)
  const team = [
    {
      name: 'Ang Kin Guan', role: 'Founder & CEO', experience: '30+', photo: angKinGuanPortrait,
      bio: 'With over 30 years in the automotive industry, Mr. Ang founded Seng Guan Auto with a vision to transform the used car buying experience in Malaysia.',
    },
    {
      name: 'John Ang', role: 'Managing Director', experience: '18+', photo: johnAngPortrait,
      bio: 'John oversees daily operations and ensures that every vehicle meets our strict quality standards before reaching our showroom floor.',
    },
    {
      name: 'Ang Zi Wei', role: 'Operations Director', experience: '15+', photo: angZiWeiPortrait,
      bio: 'Zi Wei leads our sales team with a customer-first approach, focusing on understanding client needs rather than pushing for quick sales.',
    },
  ]
  useGSAP(() => {
    const counter = aboutRef.current?.querySelector<HTMLElement>('[data-count-to="3000"]')
    const impact = aboutRef.current?.querySelector<HTMLElement>('.about-impact')
    if (!counter || !impact) return
    const target = Number(counter.dataset.countTo)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      counter.textContent = `${target}+`
      return
    }
    const value = { count: 0 }
    gsap.fromTo(value, { count: 0 }, {
      count: target,
      duration: 2.1,
      ease: 'power2.out',
      onUpdate: () => { counter.textContent = `${Math.floor(value.count)}+` },
      scrollTrigger: { trigger: impact, start: 'top 82%', once: true },
    })
  }, { scope: aboutRef })
  return (
    <div ref={aboutRef} className={`content-page content-page--about content-page--${variant.id}`}>
      <PageIntro eyebrow={t("About Seng Guan Auto")} title={t("A local showroom in Banting.")} description={t("Your trusted partner in quality used cars since 1995. Get to know the people and principles behind Seng Guan Auto.")} />
      <div className="about-impact" aria-label={t("Seng Guan Auto at a glance")}>
        <div><strong>1995</strong><span>{t("Established in Banting")}</span></div>
        <div><strong>30+</strong><span>{t("Years in used cars")}</span></div>
        <div><strong data-count-to="3000" aria-label={t("More than 3,000 customers")}>3000+</strong><span>{t("Customers")}</span></div>
      </div>
      <section className="about-feature"><div className="about-feature-image"><ProgressiveImage src={showroom} preview={showroomPreview} alt={t("Seng Guan Auto showroom in Banting")} width="1072" height="603" /></div><div className="about-feature-copy"><p className="section-label">{t("Our story")}</p><h2>{t("Built on trust since 1995.")}</h2><p>{t("What began as a small family business grew from a simple aim: offer quality pre-owned cars at fair prices and treat every customer with care.")}</p><p>{t("For more than 30 years, Seng Guan Auto has focused on transparency, integrity and customer satisfaction. Founded by Ang Kin Guan, the business continues with his sons and the values it started with: honesty, quality and putting people first.")}</p><a className="text-link" href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`} target="_blank" rel="noreferrer">{t("Visit our Banting showroom")} <ArrowUpRight size={15} aria-hidden="true" /></a></div></section>
      <section className="about-values">
        <div className="about-section-heading"><p className="section-label">{t("What guides us")}</p><h2>{t("Our core values.")}</h2><p>{t("Simple principles shape how we prepare cars and work with the people who visit us.")}</p></div>
        <div className="about-values-list">
          <article><span className="about-value-icon"><HeartHandshake size={21} aria-hidden="true" /></span><div><h3>{t("Integrity")}</h3><p>{t("We believe in honest, transparent dealings at every step.")}</p></div></article>
          <article><span className="about-value-icon"><Award size={21} aria-hidden="true" /></span><div><h3>{t("Quality")}</h3><p>{t("We inspect vehicles before offering them for sale.")}</p></div></article>
          <article><span className="about-value-icon"><CarFront size={21} aria-hidden="true" /></span><div><h3>{t("Customer first")}</h3><p>{t("We listen to what matters to you and help you make an informed choice.")}</p></div></article>
          <article><span className="about-value-icon"><ShieldCheck size={21} aria-hidden="true" /></span><div><h3>{t("Trust")}</h3><p>{t("We work to earn confidence through dependable service over time.")}</p></div></article>
        </div>
      </section>
      <section className="team-section">
        <div className="team-heading"><p className="section-label">{t("The people behind the business")}</p><h2>{t("Meet our team.")}</h2><p>{t("Local knowledge and experience, built over many years in Banting.")}</p></div>
        <div className="team-grid">
          {team.map((member) => (
            <article className="team-card" key={member.name}>
              <div className="team-photo"><ProgressiveImage src={member.photo} preview={member.photo===angKinGuanPortrait?team1Preview:member.photo===johnAngPortrait?team2Preview:team3Preview} alt={member.name} width="150" height="150" /></div>
              <h3>{member.name}</h3>
              <p className="team-role">{t(member.role)}</p>
              <p className="team-experience"><strong>{member.experience}</strong><span>{t("years experience")}</span></p>
              <p className="team-bio">{t(member.bio)}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="about-services">
        <div className="about-services-heading"><p className="section-label">{t("Support for the journey")}</p><h2>{t("More help, from first look to handover.")}</h2><p>{t("Talk with the team about the details that matter for the car you have in mind.")}</p></div>
        <div className="about-services-list">
          <article><Search size={20} aria-hidden="true" /><div><h3>{t("Vehicle inspection")}</h3><p>{t("We inspect vehicles before they reach the showroom.")}</p></div></article>
          <article><ReceiptText size={20} aria-hidden="true" /><div><h3>{t("Clear pricing")}</h3><p>{t("Review the vehicle price and terms with the team.")}</p></div></article>
          <article><ShieldCheck size={20} aria-hidden="true" /><div><h3>{t("Warranty options")}</h3><p>{t("Ask about optional warranty coverage for selected vehicles.")}</p></div></article>
          <article><Wrench size={20} aria-hidden="true" /><div><h3>{t("After-sales support")}</h3><p>{t("Get help from the team after your purchase.")}</p></div></article>
          <article><Calculator size={20} aria-hidden="true" /><div><h3>{t("Financing assistance")}</h3><p>{t("Discuss financing options and estimate your monthly payment.")}</p></div></article>
          <article><RefreshCw size={20} aria-hidden="true" /><div><h3>{t("Trade-in enquiries")}</h3><p>{t("Speak with us about trading in your current vehicle.")}</p></div></article>
        </div>
      </section>
      <VisitTeaser goToPage={goToPage} />
    </div>
  )
}

function FaqPage({ variant }: { variant: Direction }) {
  const { t } = useLocale()
  const [open, setOpen] = useState<number | null>(0)
  const categories = Array.from(new Set(faqItems.map((item) => item.category)))
  return (
    <div className={`content-page content-page--faq content-page--${variant.id}`}>
      <PageIntro eyebrow={t("Questions before a visit")} title={t("Clear answers for your next step.")} description={t("Some details depend on the car or finance provider. Use the live listing and ask the team to confirm the specifics.")} />
      <div className="faq-page-layout"><aside className="faq-category-list"><span>{t("On this page")}</span>{categories.map((category) => <a key={category} href={`#faq-${category.toLowerCase()}`}>{t(category)}</a>)}<a href="#faq-contact">{t("Contact the team")}</a></aside>
        <div className="faq-groups">{categories.map((category) => <section key={category} id={`faq-${category.toLowerCase()}`} className="faq-group"><h2>{t(category)}</h2>{faqItems.filter((item) => item.category === category).map((item) => {
          const index = faqItems.indexOf(item)
          const expanded = open === index
          return <article className={`faq-item${expanded ? ' is-open' : ''}`} key={t(item.question)}><h3><button type="button" aria-expanded={expanded} aria-controls={`faq-answer-${index}`} onClick={() => setOpen(expanded ? null : index)}>{t(item.question)}<ChevronDown size={18} aria-hidden="true" /></button></h3><div id={`faq-answer-${index}`} className="faq-answer" aria-hidden={!expanded}><div className="faq-answer-inner"><p>{t(item.answer)}</p></div></div></article>
        })}</section>)}
          <section className="faq-contact" id="faq-contact"><div><p className="section-label">{t("Still deciding?")}</p><h2>{t("Ask about the car you have in mind.")}</h2></div><a className="button button--whatsapp" href={contact.whatsapp} target="_blank" rel="noreferrer"><WhatsAppGlyph />{t("Chat on WhatsApp")}</a></section>
        </div>
      </div>
    </div>
  )
}

function ContactPage({ variant }: { variant: Direction }) {
  const { t } = useLocale()
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(contact.address)}`
  return (
    <div className={`content-page content-page--contact content-page--${variant.id}`}>
      <PageIntro eyebrow={t("Come by or get in touch")} title={t("Let’s talk about your next car.")} description={t("Ask about a car, arrange a visit, or speak with the Seng Guan Auto team.")} />
      <div className="contact-layout">
        <div className="contact-methods">
          <a className="contact-method" href={contact.phoneHref}><span className="contact-method-icon"><Phone size={19} aria-hidden="true" /></span><span><small>{t("Call the showroom")}</small><strong>{contact.phone}</strong></span><ArrowUpRight size={17} aria-hidden="true" /></a>
          <a className="contact-method" href={contact.whatsapp} target="_blank" rel="noreferrer"><span className="contact-method-icon"><MessageCircle size={19} aria-hidden="true" /></span><span><small>{t("Message on WhatsApp")}</small><strong>{t("Ask about a vehicle or visit")}</strong></span><ArrowUpRight size={17} aria-hidden="true" /></a>
          <a className="contact-method" href={`mailto:${contact.email}`}><span className="contact-method-icon"><Mail size={19} aria-hidden="true" /></span><span><small>{t("Email the team")}</small><strong>{contact.email}</strong></span><ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
        <section className="address-panel"><div className="address-map"><ProgressiveImage src={showroom} preview={showroomPreview} alt={t("Seng Guan Auto showroom frontage")} width="1072" height="603" /><a href={mapUrl} target="_blank" rel="noreferrer" className="map-label"><MapPin size={17} aria-hidden="true" />{t("Open map")} <ArrowUpRight size={14} aria-hidden="true" /></a></div><div className="address-copy"><p className="section-label">Seng Guan Auto Sdn. Bhd.</p><h2>{t("Find us in Banting.")}</h2><p>{contact.address}</p><a className="text-link" href={mapUrl} target="_blank" rel="noreferrer">{t("Get directions")} <ArrowUpRight size={15} aria-hidden="true" /></a></div></section>
      </div>
      <section className="hours-section"><div><p className="section-label">{t("Showroom hours")}</p><h2>{t("Plan a visit.")}</h2></div><dl>{contact.hours.map(([day, hours]) => <div key={day}><dt>{t(day)}</dt><dd>{t(hours)}</dd></div>)}</dl><p className="hours-note">{t("Please confirm opening hours with the team before travelling.")}</p></section>
    </div>
  )
}

function SiteFooter({ variant, goToPage }: { variant: Direction; goToPage: (page: PageId) => void }) {
  const { t } = useLocale()
  const brandLogo = variant.id === 'greenlight' ? darkLogo : logo
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(contact.address)}&navigate=yes`
  return (
    <footer className={`site-footer site-footer--${variant.id}`}>
      <p className="footer-slogan">{t("Your trusted partner in quality used cars since 1995.")}</p>
      <div className="footer-main">
        <div className="footer-brand">
          <div className="footer-brand-lockup">
            <span className={`brand-mark${variant.id === 'greenlight' ? ' brand-mark--dark' : ''}`}><img src={brandLogo} alt="Seng Guan Auto Sdn. Bhd." width="225" height="106" /></span>
            <div className="footer-legal-lockup">
              <p className="footer-company">Seng Guan Auto Sdn. Bhd.</p>
              <p className="footer-registration">{t("Company No. 202301019072 (1512994-A)")}</p>
            </div>
          </div>
          <div className="footer-address-row"><MapPin size={17} aria-hidden="true" /><p className="footer-address">{contact.address}</p></div>
          <nav className="footer-directions" aria-label={t("Showroom directions")}>
            <a href={googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={15} aria-hidden="true" /> Google Maps <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href={wazeUrl} target="_blank" rel="noreferrer"><Navigation size={15} aria-hidden="true" /> Waze <ArrowUpRight size={14} aria-hidden="true" /></a>
          </nav>
        </div>
        <div className="footer-links"><strong>{t("Explore")}</strong>{pages.slice(1, 5).map((page) => <button key={page.id} onClick={() => goToPage(page.id)}>{t(page.label)}</button>)}</div>
        <div className="footer-contact">
          <strong>{t("Get in touch")}</strong>
          <a href={contact.phoneHref}><Phone size={16} aria-hidden="true" /> {contact.phone}</a>
          <a href={`mailto:${contact.email}`}><Mail size={16} aria-hidden="true" /> {contact.email}</a>
          <div className="footer-hours"><Clock size={16} aria-hidden="true" /><div>{contact.hours.map(([day, hours]) => <span key={day}><b>{t(day)}:</b> {t(hours)}</span>)}</div></div>
        </div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Seng Guan Auto Sdn. Bhd.</span><a href={contact.inventory} target="_blank" rel="noreferrer">{t("Live inventory on Carlist")} <ArrowUpRight size={14} aria-hidden="true" /></a></div>
    </footer>
  )
}

function PrototypeDock({
  variant, currentPage, goToVariant, detailsOpen, setDetailsOpen, copyDirectionLink, saved, selectDirection,
}: {
  variant: Direction
  currentPage: PageId
  goToVariant: (id: string) => void
  detailsOpen: boolean
  setDetailsOpen: (open: boolean) => void
  copyDirectionLink: () => void
  saved: boolean
  selectDirection: () => void
}) {
  const { t } = useLocale()
  const currentIndex = directions.findIndex((item) => item.id === variant.id)
  const previous = directions[(currentIndex - 1 + directions.length) % directions.length]
  const next = directions[(currentIndex + 1) % directions.length]
  return (
    <aside className={`prototype-dock${detailsOpen ? ' is-expanded' : ''}`} aria-label={t("Design prototype selector")}>
      <div className="prototype-details" id="prototype-details" hidden={!detailsOpen}>
        <div className="prototype-details-top"><div><p>{t("Design direction")} {variant.short} / {directions.length}</p><h2>{variant.name}</h2></div><button type="button" aria-label={t("Close prototype details")} onClick={() => setDetailsOpen(false)}><X size={18} aria-hidden="true" /></button></div>
        <p className="prototype-tagline">{variant.tagline}</p><p className="prototype-layout">{t("Layout:")} {variant.layout}</p>
        <p className="prototype-skill-heading">{t("Skills used in this direction")}</p><div className="skill-tags">{variant.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><p className="skill-reason">{variant.skillReason}</p>
        <div className="prototype-detail-actions"><button type="button" className={`button button--small${saved ? ' is-saved' : ''}`} onClick={selectDirection}>{saved ? <><Check size={15} aria-hidden="true" />{t("Marked for review")}</> : t('Mark this direction')}</button><button type="button" className="copy-link" onClick={copyDirectionLink}>{t("Copy this option’s link")}</button></div>
      </div>
      <div className="dock-main">
        <button type="button" className="dock-arrow" aria-label={t('Previous direction: {name}', { name: previous.name })} onClick={() => goToVariant(previous.id)}><ArrowLeft size={17} aria-hidden="true" /></button>
        <label className="dock-select-wrap"><span>{t("Prototype")}</span><select aria-label={t("Choose a design prototype")} value={variant.id} onChange={(event) => goToVariant(event.target.value)}>{directions.map((item) => <option key={item.id} value={item.id}>{item.short} / {directions.length} · {item.name}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
        <span className="dock-page">{t(pages.find((page) => page.id === currentPage)?.label ?? '')}</span>
        <button type="button" className="dock-arrow" aria-label={t('Next direction: {name}', { name: next.name })} onClick={() => goToVariant(next.id)}><ArrowRight size={17} aria-hidden="true" /></button>
        <button type="button" className="dock-info" aria-expanded={detailsOpen} aria-controls="prototype-details" onClick={() => setDetailsOpen(!detailsOpen)}>{t(detailsOpen ? 'Close details' : 'Skills & notes')}</button>
      </div>
      <span className="dock-hint">{t("Use ← / → to compare · state is in the URL")}</span>
    </aside>
  )
}

export default App
