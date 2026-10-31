import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, Award, Calculator,
  CarFront, Check, ChevronDown, CircleHelp, Clock, Gauge, HeartHandshake, Mail, MapPin,
  Headset, Menu, MessageCircle, Navigation, Phone, ReceiptText, RefreshCw, Search, ShieldCheck,
  SlidersHorizontal, Wrench, X,
} from 'lucide-react'
import logo from './assets/logo.svg'
import darkLogo from './assets/logo-dark.svg'
import showroom from './assets/showroom.jpg'
import angKinGuanPortrait from '../../resources/team/1.jpg'
import johnAngPortrait from '../../resources/team/2.jpg'
import angZiWeiPortrait from '../../resources/team/john.jpg'
import { contact, directions, faqItems, pages, vehicles, type Direction, type PageId, type Vehicle } from './data'
import './App.css'

gsap.registerPlugin(ScrollTrigger, useGSAP)

type RouteState = { variant: string; page: PageId }

const defaultRoute: RouteState = { variant: 'greenlight', page: 'home' }

function readRoute(): RouteState {
  const fileHash = window.location.protocol === 'file:' ? window.location.hash.replace(/^#\??/, '') : ''
  const params = new URLSearchParams(fileHash || window.location.search)
  const variant = directions.some((item) => item.id === params.get('variant'))
    ? params.get('variant')!
    : defaultRoute.variant
  const page = pages.some((item) => item.id === params.get('page'))
    ? params.get('page') as PageId
    : defaultRoute.page
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
  const [route, setRoute] = useState<RouteState>(readRoute)
  const [menuOpen, setMenuOpen] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [savedDirection, setSavedDirection] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const appRef = useRef<HTMLDivElement>(null)
  const variant = directions.find((item) => item.id === route.variant) ?? directions[0]

  const updateRoute = (next: RouteState, push = true) => {
    const url = new URL(window.location.href)
    if (window.location.protocol === 'file:') {
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
          .fromTo('.showroom-whatsapp', { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1 }, '<0.12')

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
      showNotice(`Link copied for ${variant.name}.`)
    } catch {
      showNotice('Copy the address in your browser to share this direction.')
    }
  }

  const navTo = (page: PageId) => window.location.protocol === 'file:'
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
    <div className="prototype-app" data-variant={variant.id} ref={appRef} onDragStart={preventImageDrag} onContextMenu={preventImageContextMenu}>
      {variant.id === 'greenlight' && <div className="site-atmosphere" aria-hidden="true" />}
      <a className="skip-link" href="#main-content">Skip to content</a>
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
      <PrototypeDock
        variant={variant}
        currentPage={route.page}
        goToVariant={goToVariant}
        detailsOpen={detailsOpen}
        setDetailsOpen={setDetailsOpen}
        copyDirectionLink={copyDirectionLink}
        saved={savedDirection === variant.id}
        selectDirection={() => {
          setSavedDirection(variant.id)
          showNotice(`${variant.name} marked for review in this session.`)
        }}
      />
      <div className="notice" aria-live="polite" aria-atomic="true">{notice}</div>
    </div>
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
  const brandLogo = variant.id === 'greenlight' ? darkLogo : logo
  const navRef = useRef<HTMLElement>(null)
  const navIndicatorRef = useRef<HTMLSpanElement>(null)

  useGSAP(() => {
    const nav = navRef.current
    const indicator = navIndicatorRef.current
    const activeLink = nav?.querySelector<HTMLAnchorElement>('a[aria-current="page"]')
    if (!nav || !indicator || !activeLink || !window.matchMedia('(min-width: 761px)').matches) return

    gsap.to(indicator, {
      x: activeLink.offsetLeft,
      width: activeLink.offsetWidth,
      duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 0.42,
      ease: 'power3.out',
      overwrite: true,
    })
  }, { dependencies: [activePage], scope: navRef })

  return (
    <header className={`site-header site-header--${variant.id}`}>
      <div className="header-inner">
        <a className="brand" href={navTo('home')} onClick={interceptRoute('home')} aria-label="Seng Guan Auto home">
          <span className={`brand-mark${variant.id === 'greenlight' ? ' brand-mark--dark' : ''}`}><img src={brandLogo} alt="Seng Guan Auto Sdn. Bhd." width="225" height="106" /></span>
          <span className="brand-caption">Your trusted partner in quality used cars since 1995.</span>
        </a>
        <button className="menu-toggle" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>
        <nav ref={navRef} className={`main-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          {pages.map((page) => (
            <a key={page.id} href={navTo(page.id)} onClick={interceptRoute(page.id)} aria-current={activePage === page.id ? 'page' : undefined}>
              {page.label}
            </a>
          ))}
          <a className="nav-inventory" href={contact.inventory} target="_blank" rel="noreferrer">
            Current listings <ArrowUpRight aria-hidden="true" size={15} />
          </a>
          <span className="nav-indicator" ref={navIndicatorRef} aria-hidden="true" />
        </nav>
        <a className="header-contact header-contact--whatsapp" href={contact.whatsapp} target="_blank" rel="noreferrer">
          <WhatsAppGlyph /> <span>Ask about a car</span>
        </a>
        <CustomerServiceWidget enabled={variant.id === 'greenlight'} />
      </div>
    </header>
  )
}

function CustomerServiceWidget({ enabled }: { enabled: boolean }) {
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
    <button ref={buttonRef} className="header-customer-service" type="button" aria-label="Open customer service chat" aria-expanded={open} disabled={!ready}>
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
  const columns = [
    [vehicles[4], vehicles[0], vehicles[5], vehicles[2]],
    [vehicles[1], vehicles[7], vehicles[3], vehicles[0]],
    [vehicles[6], vehicles[2], vehicles[3], vehicles[5]],
  ]

  return (
    <div className="featured-display">
      <div className="showroom-gallery" aria-hidden="true">
        {columns.map((column, columnIndex) => (
          <div className={`showroom-gallery-column showroom-gallery-column--${columnIndex + 1}`} key={columnIndex}>
            <div className="showroom-gallery-track">
              {[0, 1].map((loopIndex) => (
                <div className="showroom-gallery-set" key={loopIndex}>
                  {column.map((car, carIndex) => (
                    <div className="showroom-gallery-tile" key={`${loopIndex}-${car.id}-${carIndex}`}>
                      <img src={car.photo} alt="" width="300" height="200" loading="lazy" />
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
        <button className="showroom-art-link" onClick={onBrowse}>Explore featured cars <ArrowUpRight size={16} aria-hidden="true" /></button>
      </div>
    </div>
  )
}

function ShowroomHeroImage() {
  const [activeIndex, setActiveIndex] = useState(1)
  const [incomingIndex, setIncomingIndex] = useState<number | null>(null)
  const activeIndexRef = useRef(1)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

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
  }, [])

  return (
    <div className="showroom-image" aria-hidden="true">
      {vehicles.map((vehicle, index) => {
        const isVisible = index === activeIndex && incomingIndex === null || index === incomingIndex
        return (
          <img
            key={vehicle.id}
            className={`showroom-photo${isVisible ? ' showroom-photo--visible' : ''}`}
            src={vehicle.photo}
            alt=""
            width="300"
            height="200"
            loading="eager"
            decoding="async"
            fetchPriority={index === activeIndex ? 'high' : 'auto'}
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
  const primaryCar = vehicles[1]
  const budgetCar = vehicles[2]
  switch (variant.id) {
    case 'lot-712':
      return (
        <section className="hero hero--lot">
          <div className="hero-lot-copy hero-copy">
            <p className="location-line"><MapPin size={15} aria-hidden="true" /> Banting, Selangor</p>
            <h1>A better way to find your next car.</h1>
            <p>Explore the cars we feature, ask what you need to know, and plan a visit to our Banting showroom.</p>
            <div className="hero-actions"><button className="button button--primary" onClick={() => goToPage('cars')}>Explore featured cars <ArrowRight size={17} aria-hidden="true" /></button><button className="button button--plain" onClick={() => goToPage('contact')}>Talk to the team</button></div>
            <div className="lot-note"><span className="lot-note-rule" />Local dealership · Direct contact · Carlist inventory</div>
          </div>
          <div className="hero-art hero-lot-photo"><img src={showroom} alt="Seng Guan Auto's roadside showroom in Banting" width="1072" height="603" fetchPriority="high" /></div>
        </section>
      )
    case 'drive-finder':
      return (
        <section className="hero hero--finder">
          <div className="finder-image"><img src={budgetCar.photo} alt={`${budgetCar.year} ${budgetCar.name}`} width="300" height="200" fetchPriority="high" /></div>
          <div className="finder-content hero-copy">
            <p className="hero-overline">Seng Guan Auto · Used cars</p>
            <h1>Find a car that feels right.</h1>
            <p>Start with the body style or make you have in mind. Check live details on our Carlist page.</p>
            <div className="finder-actions">
              <button className="button button--primary" onClick={() => goToPage('cars')}><Search size={17} aria-hidden="true" /> Browse featured cars</button>
              <button className="button button--soft" onClick={() => goToPage('finance')}><Calculator size={17} aria-hidden="true" /> Estimate a payment</button>
            </div>
          </div>
          <div className="finder-footer"><span>Cars for everyday drives</span><span>Information first, conversation next</span></div>
        </section>
      )
    case 'night-shift':
      return (
        <section className="hero hero--night">
          <div className="night-copy hero-copy">
            <p className="night-kicker"><span /> Banting, Selangor</p>
            <h1>Find your next<br /><em>open road.</em></h1>
            <p>Good cars deserve a closer look. Browse the featured selection and ask us about the details.</p>
            <div className="hero-actions"><button className="button button--accent" onClick={() => goToPage('cars')}>Explore the lot <ArrowDownRight size={17} aria-hidden="true" /></button><button className="button button--outline-light" onClick={() => goToPage('contact')}>Plan a visit</button></div>
            <span className="night-number">SG / AUTO</span>
          </div>
          <div className="hero-art night-art"><img src={primaryCar.photo} alt={`${primaryCar.year} ${primaryCar.name}`} width="300" height="200" fetchPriority="high" /><span className="night-art-caption">Featured drive / BMW 530i</span></div>
          <div className="night-edge" aria-hidden="true">SENG GUAN AUTO</div>
        </section>
      )
    case 'everyday-miles':
      return (
        <section className="hero hero--everyday">
          <div className="everyday-visual hero-art"><img src={vehicles[3].photo} alt={`${vehicles[3].year} ${vehicles[3].name}`} width="300" height="200" fetchPriority="high" /><div className="everyday-caption"><span>Room for the whole day</span><span>Ask about the Vellfire</span></div></div>
          <div className="everyday-copy hero-copy">
            <p className="hero-overline">A local car search, made personal</p>
            <h1>More room for the life you lead.</h1>
            <p>Compare a few options, work out a comfortable budget, then speak with the team about the car that caught your eye.</p>
            <div className="everyday-links"><button onClick={() => goToPage('cars')}><CarFront aria-hidden="true" /> Browse cars</button><button onClick={() => goToPage('finance')}><Calculator aria-hidden="true" /> Plan a payment</button><button onClick={() => goToPage('contact')}><MapPin aria-hidden="true" /> Visit Banting</button></div>
          </div>
        </section>
      )
    case 'the-collection':
      return (
        <section className="hero hero--collection">
          <img className="collection-image hero-art" src={primaryCar.photo} alt={`${primaryCar.year} ${primaryCar.name}`} width="300" height="200" fetchPriority="high" />
          <div className="collection-copy hero-copy">
            <p className="collection-label">Seng Guan Auto / Banting</p>
            <h1>Good cars.<br />A closer look.</h1>
            <p>A small selection to start your search. Find the live details on Carlist or ask us about a visit.</p>
            <button className="button button--light" onClick={() => goToPage('cars')}>View the selection <ArrowUpRight size={17} aria-hidden="true" /></button>
          </div>
          <div className="collection-stamp">S G<br /><span>USED CARS</span></div>
        </section>
      )
    case 'spec-ledger':
      return (
        <section className="hero hero--ledger">
          <div className="ledger-top hero-copy"><div><p className="ledger-label">Seng Guan Auto / Used vehicles</p><h1>Start with what matters.</h1></div><p>Filter the featured selection, review the basics, then check current price and availability on Carlist.</p></div>
          <div className="ledger-feature hero-art"><img src={budgetCar.photo} alt={`${budgetCar.year} ${budgetCar.name}`} width="300" height="200" fetchPriority="high" /><div className="ledger-specs"><span>Featured</span><strong>{budgetCar.year} {budgetCar.name}</strong><span>Petrol <i /> Automatic</span></div><button className="button button--primary" onClick={() => goToPage('cars')}>Open vehicle index <ArrowRight size={16} aria-hidden="true" /></button></div>
          <div className="ledger-bottom"><span>Used cars</span><span>Carlist for live details</span><span>Questions welcome</span></div>
        </section>
      )
    case 'drive-journal':
      return (
        <section className="hero hero--journal">
          <div className="journal-masthead"><span>THE SENG GUAN JOURNAL</span><span>BANTING · SELANGOR</span></div>
          <div className="journal-grid">
            <div className="journal-copy hero-copy"><p className="journal-date">The showroom, this week</p><h1>Every car has a story. Start with yours.</h1><p>Browse a few of the vehicles featured on our site, then get the latest details from the live listings.</p><button className="button button--primary" onClick={() => goToPage('cars')}>Turn the first page <ArrowRight size={17} aria-hidden="true" /></button></div>
            <div className="journal-photo hero-art"><img src={showroom} alt="Seng Guan Auto showroom frontage in Banting" width="1072" height="603" fetchPriority="high" /><span>Lot 712 · Batu 18 · Banting</span></div>
          </div>
          <div className="journal-foot"><span>Cars, people, and the road ahead</span><span>Read the buying guide <ArrowDownRight size={15} aria-hidden="true" /></span></div>
        </section>
      )
    case 'open-lot':
      return (
        <section className="hero hero--open-lot">
          <div className="open-lot-header"><span>SENG GUAN AUTO</span><span>USED CARS / BANTING</span></div>
          <div className="open-lot-title hero-copy"><h1>OPEN<br /><span>LOT</span></h1><div><p>Look through the current homepage selection. For prices and availability, go straight to the live dealer listings.</p><button className="button button--primary" onClick={() => goToPage('cars')}>Browse vehicles <ArrowRight size={17} aria-hidden="true" /></button></div></div>
          <div className="open-lot-photo hero-art"><img src={vehicles[0].photo} alt={`${vehicles[0].year} ${vehicles[0].name}`} width="300" height="200" fetchPriority="high" /><span>Featured vehicle / {vehicles[0].year}</span></div>
          <div className="open-lot-tape"><span>Find</span><span>Ask</span><span>Visit</span></div>
        </section>
      )
    case 'monthly-key':
      return (
        <section className="hero hero--monthly">
          <div className="monthly-copy hero-copy"><p className="hero-overline">Take the next step at your own pace</p><h1>Could this car fit your month?</h1><p>Try a private, browser-only estimate. Your numbers stay on this device and are not sent anywhere.</p><div className="monthly-actions"><button className="button button--primary" onClick={() => goToPage('finance')}><Calculator size={17} aria-hidden="true" /> Open calculator</button><button className="button button--plain" onClick={() => goToPage('cars')}>Browse cars</button></div></div>
          <div className="monthly-visual hero-art"><img src={budgetCar.photo} alt={`${budgetCar.year} ${budgetCar.name}`} width="300" height="200" fetchPriority="high" /><div className="monthly-sticker"><span>Estimate only</span><strong>RM / month</strong><small>Set your own inputs</small></div></div>
        </section>
      )
    case 'greenlight':
      return (
        <section className="hero hero--showroom">
          <ShowroomHeroImage />
          <div className="showroom-copy hero-copy">
            <p className="showroom-kicker"><span>Used cars</span><i aria-hidden="true" /> Banting, Selangor</p>
            <h1>Your next car.<br /><span>Right here.</span></h1>
            <p>Explore the featured selection from Seng Guan Auto. Check current availability and details on our live listings.</p>
            <div className="hero-actions showroom-actions"><button className="button button--primary" onClick={() => goToPage('cars')}>Browse vehicles <ArrowRight size={17} aria-hidden="true" /></button><button className="button button--outline-light" onClick={() => goToPage('finance')}><Calculator size={17} aria-hidden="true" /> Loan calculator</button></div>
          </div>
          <a className="showroom-whatsapp" href={contact.whatsapp} target="_blank" rel="noreferrer"><MessageCircle size={16} aria-hidden="true" /> Ask us about a car <ArrowUpRight size={14} aria-hidden="true" /></a>
        </section>
      )
    default:
      return (
        <section className="hero hero--clear">
          <div className="clear-top"><div className="hero-copy"><p className="hero-overline">Seng Guan Auto · Banting</p><h1>Used cars, with room to think.</h1></div><p>Browse a selection, check live details on Carlist, and contact the team when you are ready.</p></div>
          <div className="clear-image hero-art"><img src={vehicles[5].photo} alt={`${vehicles[5].year} ${vehicles[5].name}`} width="300" height="200" fetchPriority="high" /><button className="button button--primary" onClick={() => goToPage('cars')}>See featured cars <ArrowRight size={16} aria-hidden="true" /></button></div>
          <div className="clear-bottom"><span>01 / Browse</span><span>02 / Compare</span><span>03 / Ask</span></div>
        </section>
      )
  }
}

function VehicleTeaser({ variantId, goToPage }: { variantId: string; goToPage: (page: PageId) => void }) {
  return (
    <section className="section section-vehicles">
      {variantId === 'greenlight' ? (
        <div className="featured-showcase">
          <div className="featured-showcase-copy">
            <p className="section-label">A few to get you started</p>
            <h2>Featured vehicles</h2>
            <p>Start with a few cars from the Seng Guan Auto homepage selection.</p>
            <button className="text-link" onClick={() => goToPage('cars')}>See all featured cars <ArrowRight size={17} aria-hidden="true" /></button>
          </div>
          <FeaturedVehicleDisplay onBrowse={() => goToPage('cars')} />
        </div>
      ) : (
        <div className="section-heading"><div><p className="section-label">A few to get you started</p><h2>Featured vehicles</h2></div><button className="text-link" onClick={() => goToPage('cars')}>See all featured cars <ArrowRight size={17} aria-hidden="true" /></button></div>
      )}
      <p className="data-note">Sample cars from the existing homepage. Live prices and availability are on <a href={contact.inventory} target="_blank" rel="noreferrer">Carlist</a>.</p>
    </section>
  )
}

function VehicleCard({ car, compact = false }: { car: Vehicle; compact?: boolean }) {
  return (
    <article className={`vehicle-card${compact ? ' vehicle-card--compact' : ''}`}>
      <a className="vehicle-photo" href={contact.inventory} target="_blank" rel="noreferrer" aria-label={`Check current details for ${car.year} ${car.name} on Carlist`}>
        <img src={car.photo} alt={`${car.year} ${car.name}`} width="300" height="200" loading="lazy" />
        <span className="vehicle-year">{car.year}</span>
      </a>
      <div className="vehicle-info">
        <div className="vehicle-title"><span>{car.make}</span><h3>{car.name}</h3></div>
        <div className="vehicle-specs"><span><CarFront size={14} aria-hidden="true" /> {car.body}</span><span><Gauge size={14} aria-hidden="true" /> {car.transmission}</span></div>
        <a className="vehicle-link" href={contact.inventory} target="_blank" rel="noreferrer">Check live details <ArrowUpRight size={15} aria-hidden="true" /></a>
      </div>
    </article>
  )
}

function FinanceTeaser({ goToPage }: { goToPage: (page: PageId) => void }) {
  return (
    <section className="section finance-teaser">
      <div className="finance-teaser-copy"><p className="section-label">Plan before you visit</p><h2>Put your own numbers into the picture.</h2><p>Estimate a monthly payment with an on-page calculator. Your inputs stay in your browser.</p><button className="button button--primary" onClick={() => goToPage('finance')}>Try the calculator <ArrowRight size={17} aria-hidden="true" /></button></div>
      <div className="finance-teaser-art"><div className="finance-paper"><span>CAR PRICE</span><strong>RM —</strong><span>DOWN PAYMENT</span><strong>RM —</strong><hr /><span>MONTHLY ESTIMATE</span><strong className="estimate-value">RM —</strong></div><span className="estimate-note">Illustration only · no information submitted</span></div>
    </section>
  )
}

function StoryTeaser({ variant, goToPage }: { variant: Direction; goToPage: (page: PageId) => void }) {
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(contact.address)}&navigate=yes`
  return (
    <section className={`section story-teaser${variant.id === 'night-shift' ? ' nightshift-proof' : ''}`}>
      <div className="story-photo"><img src={showroom} alt="Seng Guan Auto's dealership in Banting" width="1072" height="603" loading="lazy" /></div>
      <div className="story-copy"><p className="section-label">The place behind the name</p><h2>Find us in Banting.</h2><p>Visit Seng Guan Auto at Lot 712, Batu 18, Jln Klang Banting. Browse the current listings first, then contact the team if you would like to see a vehicle.</p>
        {variant.id === 'greenlight' ? (
          <div className="story-directions">
            <a className="button button--plain story-direction-link story-direction-link--maps" href={googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={17} aria-hidden="true" /> Google Maps</a>
            <a className="button button--plain story-direction-link story-direction-link--waze" href={wazeUrl} target="_blank" rel="noreferrer"><Navigation size={17} aria-hidden="true" /> Waze</a>
          </div>
        ) : (
          <button className="text-link" onClick={() => goToPage('about')}>About the dealership <ArrowRight size={17} aria-hidden="true" /></button>
        )}
      </div>
    </section>
  )
}

function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path fill="currentColor" d="M20.52 3.48A11.82 11.82 0 0 0 12.1 0C5.55 0 .22 5.33.22 11.9c0 2.1.55 4.14 1.59 5.95L.12 24l6.3-1.66a11.9 11.9 0 0 0 5.68 1.45h.01c6.56 0 11.9-5.34 11.9-11.9a11.82 11.82 0 0 0-3.49-8.41Zm-8.42 18.3h-.01a9.9 9.9 0 0 1-5.04-1.38l-.36-.22-3.74.98 1-3.64-.24-.38a9.85 9.85 0 0 1-1.51-5.25c0-5.46 4.44-9.9 9.9-9.9a9.84 9.84 0 0 1 7 2.9 9.83 9.83 0 0 1 2.9 7c0 5.45-4.44 9.89-9.9 9.89Zm5.43-7.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.23-.64.08-.3-.15-1.26-.47-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.34.45-.52.15-.17.2-.3.3-.49.1-.2.05-.38-.03-.53-.07-.15-.67-1.61-.91-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.87 1.21 3.07c.15.2 2.09 3.2 5.07 4.49.71.3 1.26.49 1.69.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.08-.13-.27-.2-.57-.35Z" />
    </svg>
  )
}

function VisitTeaser({ goToPage }: { goToPage: (page: PageId) => void }) {
  return (
    <section className="section visit-teaser">
      <div><p className="section-label">A conversation starts here</p><h2>Have a car in mind?</h2><p>Ask about a vehicle, arrange a visit, or talk through the next step with the Seng Guan Auto team.</p></div>
      <div className="visit-actions"><a className="button button--whatsapp" href={contact.whatsapp} target="_blank" rel="noreferrer"><WhatsAppGlyph /> Ask on WhatsApp</a><button className="button button--plain" onClick={() => goToPage('contact')}>Contact details</button></div>
    </section>
  )
}

function FaqTeaser({ goToPage }: { goToPage: (page: PageId) => void }) {
  return (
    <section className="section faq-teaser">
      <div><p className="section-label">The buying questions</p><h2>Know what to ask.</h2></div>
      <div className="faq-teaser-questions"><p>Can I arrange a test drive?</p><p>What should I ask about financing?</p><p>Where can I see current prices?</p><button className="text-link" onClick={() => goToPage('faq')}>Read the FAQs <ArrowRight size={17} aria-hidden="true" /></button></div>
    </section>
  )
}

function InventoryPage({ variant }: { variant: Direction }) {
  const [search, setSearch] = useState('')
  const [make, setMake] = useState('All makes')
  const makes = ['All makes', ...Array.from(new Set(vehicles.map((item) => item.make)))]
  const filtered = useMemo(() => vehicles.filter((car) => {
    const matchesMake = make === 'All makes' || car.make === make
    const text = `${car.year} ${car.name} ${car.body}`.toLowerCase()
    return matchesMake && text.includes(search.toLowerCase())
  }), [make, search])

  return (
    <div className={`content-page content-page--cars content-page--${variant.id}`}>
      <PageIntro eyebrow="The featured selection" title="Find a car to look closer at." description="Search the sample vehicles shown on the existing homepage. Open Carlist for the live listing, price, and availability." />
      <section className="inventory-browser" aria-label="Featured vehicle browser">
        <div className="inventory-tools">
          <label className="search-field"><Search size={18} aria-hidden="true" /><span className="sr-only">Search featured vehicles</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search make or model…" type="search" /></label>
          <div className="make-filters" role="group" aria-label="Filter by make">
            {makes.map((option) => <button key={option} type="button" className={make === option ? 'is-selected' : ''} aria-pressed={make === option} onClick={() => setMake(option)}>{option}</button>)}
          </div>
          <span className="result-count"><SlidersHorizontal size={15} aria-hidden="true" /> {filtered.length} featured {filtered.length === 1 ? 'car' : 'cars'}</span>
        </div>
        {filtered.length ? <div className="inventory-grid">{filtered.map((car) => <VehicleCard key={car.id} car={car} />)}</div> : <div className="empty-state"><CarFront size={25} aria-hidden="true" /><h2>No featured cars match that search.</h2><p>Try another model or select “All makes”.</p><button className="button button--primary" onClick={() => { setSearch(''); setMake('All makes') }}>Reset filters</button></div>}
        <p className="data-note">Prototype sample only. <a href={contact.inventory} target="_blank" rel="noreferrer">See current listings and availability on Carlist <ArrowUpRight size={13} aria-hidden="true" /></a></p>
      </section>
    </div>
  )
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <header className="page-intro"><p className="section-label">{eyebrow}</p><h1>{title}</h1><p>{description}</p></header>
}

function FinancePage({ variant }: { variant: Direction }) {
  const [price, setPrice] = useState('80000')
  const [down, setDown] = useState('8000')
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
  const formatMoney = (n: number) => new Intl.NumberFormat('en-MY', { style: 'currency', currency: 'MYR', maximumFractionDigits: 0 }).format(n)

  const calculate = () => {
    setError('')
    if (![amount, downAmount, annualRate, term].every(Number.isFinite) || amount <= 0 || downAmount < 0 || downAmount >= amount || annualRate < 0 || term <= 0 || term > 9) {
      setCalculated(false)
      setError('Check your inputs: enter a price, a smaller down payment, a non-negative rate, and a term from 1 to 9 years.')
      return
    }
    setCalculated(true)
  }

  return (
    <div className={`content-page content-page--finance content-page--${variant.id}`}>
      <PageIntro eyebrow="A browser-only estimate" title="Plan a payment that works for you." description="Change the example values, calculate a simple estimate, and discuss actual terms with a finance provider." />
      <section className="calculator-layout">
        <div className="calculator-panel">
          <div className="calculator-heading"><div><p className="section-label">Loan calculator</p><h2>Your estimate</h2></div><Calculator size={24} aria-hidden="true" /></div>
          <div className="calculator-fields">
            <label>Car price <span>RM</span><input name="car-price" inputMode="decimal" type="number" min="1" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
            <label>Down payment <span>RM</span><input name="down-payment" inputMode="decimal" type="number" min="0" value={down} onChange={(event) => setDown(event.target.value)} /></label>
            <label>Interest rate <span>% per year</span><input name="interest-rate" inputMode="decimal" type="number" min="0" step="0.1" value={rate} onChange={(event) => setRate(event.target.value)} /></label>
            <label>Loan term <span>Years · up to 9</span><input name="loan-term" inputMode="numeric" type="number" min="1" max="9" value={years} onChange={(event) => setYears(event.target.value)} /></label>
          </div>
          <button className="button button--primary calculate-button" type="button" onClick={calculate}>Calculate estimate <ArrowRight size={17} aria-hidden="true" /></button>
          {error && <p className="field-error" role="alert">{error}</p>}
          {calculated && <div className="estimate-result" aria-live="polite"><span>Estimated monthly payment</span><strong>{formatMoney(monthly)}</strong><p>Estimated loan amount: {formatMoney(loan)} · {term} years</p></div>}
          <p className="calculator-disclaimer">Illustrative flat-rate calculation only. Actual rates, eligibility, fees, and terms vary. Your inputs stay in this browser and are not submitted.</p>
        </div>
        <aside className="finance-aside"><div className="finance-aside-icon"><CircleHelp size={22} aria-hidden="true" /></div><h2>What should I compare?</h2><ul><li>Monthly payment and total repayment</li><li>Down payment and loan length</li><li>Provider terms and any additional fees</li><li>Vehicle price and live availability</li></ul><a className="text-link" href={contact.whatsapp} target="_blank" rel="noreferrer">Ask the team about financing <ArrowUpRight size={15} aria-hidden="true" /></a></aside>
      </section>
      <section className="finance-next"><div><p className="section-label">Keep your options open</p><h2>Compare the car and the payment together.</h2></div><a className="button button--primary" href={contact.inventory} target="_blank" rel="noreferrer">Browse current listings <ArrowUpRight size={16} aria-hidden="true" /></a></section>
    </div>
  )
}

function AboutPage({ variant, goToPage }: { variant: Direction; goToPage: (page: PageId) => void }) {
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
      <PageIntro eyebrow="About Seng Guan Auto" title="A local showroom in Banting." description="Your trusted partner in quality used cars since 1995. Get to know the people and principles behind Seng Guan Auto." />
      <section className="about-feature"><div className="about-feature-image"><img src={showroom} alt="Seng Guan Auto showroom in Banting" width="1072" height="603" /></div><div className="about-feature-copy"><p className="section-label">Our story</p><h2>Built on trust since 1995.</h2><p>What began as a small family business grew from a simple aim: offer quality pre-owned cars at fair prices and treat every customer with care.</p><p>For more than 30 years, Seng Guan Auto has focused on transparency, integrity and customer satisfaction. Founded by Ang Kin Guan, the business continues with his sons and the values it started with: honesty, quality and putting people first.</p><a className="text-link" href={`https://maps.google.com/?q=${encodeURIComponent(contact.address)}`} target="_blank" rel="noreferrer">Visit our Banting showroom <ArrowUpRight size={15} aria-hidden="true" /></a></div></section>
      <div className="about-impact" aria-label="Seng Guan Auto at a glance">
        <div><strong>1995</strong><span>Established in Banting</span></div>
        <div><strong>30+</strong><span>Years in used cars</span></div>
        <div><strong data-count-to="3000" aria-label="More than 3,000 customers">3000+</strong><span>Customers</span></div>
      </div>
      <section className="about-values">
        <div className="about-section-heading"><p className="section-label">What guides us</p><h2>Our core values.</h2><p>Simple principles shape how we prepare cars and work with the people who visit us.</p></div>
        <div className="about-values-list">
          <article><span className="about-value-icon"><HeartHandshake size={21} aria-hidden="true" /></span><div><h3>Integrity</h3><p>We believe in honest, transparent dealings at every step.</p></div></article>
          <article><span className="about-value-icon"><Award size={21} aria-hidden="true" /></span><div><h3>Quality</h3><p>We inspect vehicles before offering them for sale.</p></div></article>
          <article><span className="about-value-icon"><CarFront size={21} aria-hidden="true" /></span><div><h3>Customer first</h3><p>We listen to what matters to you and help you make an informed choice.</p></div></article>
          <article><span className="about-value-icon"><ShieldCheck size={21} aria-hidden="true" /></span><div><h3>Trust</h3><p>We work to earn confidence through dependable service over time.</p></div></article>
        </div>
      </section>
      <section className="team-section">
        <div className="team-heading"><p className="section-label">The people behind the business</p><h2>Meet our team.</h2><p>Local knowledge and experience, built over many years in Banting.</p></div>
        <div className="team-grid">
          {team.map((member) => (
            <article className="team-card" key={member.name}>
              <div className="team-photo"><img src={member.photo} alt={member.name} width="150" height="150" loading="lazy" /></div>
              <h3>{member.name}</h3>
              <p className="team-role">{member.role}</p>
              <p className="team-experience"><strong>{member.experience}</strong><span>years experience</span></p>
              <p className="team-bio">{member.bio}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="about-services">
        <div className="about-services-heading"><p className="section-label">Support for the journey</p><h2>More help, from first look to handover.</h2><p>Talk with the team about the details that matter for the car you have in mind.</p></div>
        <div className="about-services-list">
          <article><Search size={20} aria-hidden="true" /><div><h3>Vehicle inspection</h3><p>We inspect vehicles before they reach the showroom.</p></div></article>
          <article><ReceiptText size={20} aria-hidden="true" /><div><h3>Clear pricing</h3><p>Review the vehicle price and terms with the team.</p></div></article>
          <article><ShieldCheck size={20} aria-hidden="true" /><div><h3>Warranty options</h3><p>Ask about optional warranty coverage for selected vehicles.</p></div></article>
          <article><Wrench size={20} aria-hidden="true" /><div><h3>After-sales support</h3><p>Get help from the team after your purchase.</p></div></article>
          <article><Calculator size={20} aria-hidden="true" /><div><h3>Financing assistance</h3><p>Discuss financing options and estimate your monthly payment.</p></div></article>
          <article><RefreshCw size={20} aria-hidden="true" /><div><h3>Trade-in enquiries</h3><p>Speak with us about trading in your current vehicle.</p></div></article>
        </div>
      </section>
      <VisitTeaser goToPage={goToPage} />
    </div>
  )
}

function FaqPage({ variant }: { variant: Direction }) {
  const [open, setOpen] = useState<number | null>(0)
  const categories = Array.from(new Set(faqItems.map((item) => item.category)))
  return (
    <div className={`content-page content-page--faq content-page--${variant.id}`}>
      <PageIntro eyebrow="Questions before a visit" title="Clear answers for your next step." description="Some details depend on the car or finance provider. Use the live listing and ask the team to confirm the specifics." />
      <div className="faq-page-layout"><aside className="faq-category-list"><span>On this page</span>{categories.map((category) => <a key={category} href={`#faq-${category.toLowerCase()}`}>{category}</a>)}<a href="#faq-contact">Contact the team</a></aside>
        <div className="faq-groups">{categories.map((category) => <section key={category} id={`faq-${category.toLowerCase()}`} className="faq-group"><h2>{category}</h2>{faqItems.filter((item) => item.category === category).map((item) => {
          const index = faqItems.indexOf(item)
          const expanded = open === index
          return <article className={`faq-item${expanded ? ' is-open' : ''}`} key={item.question}><h3><button type="button" aria-expanded={expanded} aria-controls={`faq-answer-${index}`} onClick={() => setOpen(expanded ? null : index)}>{item.question}<ChevronDown size={18} aria-hidden="true" /></button></h3><div id={`faq-answer-${index}`} className="faq-answer" aria-hidden={!expanded}><div className="faq-answer-inner"><p>{item.answer}</p></div></div></article>
        })}</section>)}
          <section className="faq-contact" id="faq-contact"><div><p className="section-label">Still deciding?</p><h2>Ask about the car you have in mind.</h2></div><a className="button button--whatsapp" href={contact.whatsapp} target="_blank" rel="noreferrer"><WhatsAppGlyph /> Chat on WhatsApp</a></section>
        </div>
      </div>
    </div>
  )
}

function ContactPage({ variant }: { variant: Direction }) {
  const mapUrl = `https://maps.google.com/?q=${encodeURIComponent(contact.address)}`
  return (
    <div className={`content-page content-page--contact content-page--${variant.id}`}>
      <PageIntro eyebrow="Come by or get in touch" title="Let’s talk about your next car." description="Choose the contact path that works for you. This prototype does not collect or store messages." />
      <div className="contact-layout">
        <div className="contact-methods">
          <a className="contact-method" href={contact.phoneHref}><span className="contact-method-icon"><Phone size={19} aria-hidden="true" /></span><span><small>Call the showroom</small><strong>{contact.phone}</strong></span><ArrowUpRight size={17} aria-hidden="true" /></a>
          <a className="contact-method" href={contact.whatsapp} target="_blank" rel="noreferrer"><span className="contact-method-icon"><MessageCircle size={19} aria-hidden="true" /></span><span><small>Message on WhatsApp</small><strong>Ask about a vehicle or visit</strong></span><ArrowUpRight size={17} aria-hidden="true" /></a>
          <a className="contact-method" href={`mailto:${contact.email}`}><span className="contact-method-icon"><Mail size={19} aria-hidden="true" /></span><span><small>Email the team</small><strong>{contact.email}</strong></span><ArrowUpRight size={17} aria-hidden="true" /></a>
        </div>
        <section className="address-panel"><div className="address-map"><img src={showroom} alt="Seng Guan Auto showroom frontage" width="1072" height="603" loading="lazy" /><a href={mapUrl} target="_blank" rel="noreferrer" className="map-label"><MapPin size={17} aria-hidden="true" /> Open map <ArrowUpRight size={14} aria-hidden="true" /></a></div><div className="address-copy"><p className="section-label">Seng Guan Auto Sdn. Bhd.</p><h2>Find us in Banting.</h2><p>{contact.address}</p><a className="text-link" href={mapUrl} target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={15} aria-hidden="true" /></a></div></section>
      </div>
      <section className="hours-section"><div><p className="section-label">Showroom hours</p><h2>Plan a visit.</h2></div><dl>{contact.hours.map(([day, hours]) => <div key={day}><dt>{day}</dt><dd>{hours}</dd></div>)}</dl><p className="hours-note">Hours shown from the current site. Please confirm before travelling.</p></section>
    </div>
  )
}

function SiteFooter({ variant, goToPage }: { variant: Direction; goToPage: (page: PageId) => void }) {
  const brandLogo = variant.id === 'greenlight' ? darkLogo : logo
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(contact.address)}`
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(contact.address)}&navigate=yes`
  return (
    <footer className={`site-footer site-footer--${variant.id}`}>
      <p className="footer-slogan">Your trusted partner in quality used cars since 1995.</p>
      <div className="footer-main">
        <div className="footer-brand">
          <div className="footer-brand-lockup">
            <span className={`brand-mark${variant.id === 'greenlight' ? ' brand-mark--dark' : ''}`}><img src={brandLogo} alt="Seng Guan Auto Sdn. Bhd." width="225" height="106" /></span>
            <div className="footer-legal-lockup">
              <p className="footer-company">Seng Guan Auto Sdn. Bhd.</p>
              <p className="footer-registration">Company No. 202301019072 (1512994-A)</p>
            </div>
          </div>
          <div className="footer-address-row"><MapPin size={17} aria-hidden="true" /><p className="footer-address">{contact.address}</p></div>
          <nav className="footer-directions" aria-label="Showroom directions">
            <a href={googleMapsUrl} target="_blank" rel="noreferrer"><MapPin size={15} aria-hidden="true" /> Google Maps <ArrowUpRight size={14} aria-hidden="true" /></a>
            <a href={wazeUrl} target="_blank" rel="noreferrer"><Navigation size={15} aria-hidden="true" /> Waze <ArrowUpRight size={14} aria-hidden="true" /></a>
          </nav>
        </div>
        <div className="footer-links"><strong>Explore</strong>{pages.slice(1, 5).map((page) => <button key={page.id} onClick={() => goToPage(page.id)}>{page.label}</button>)}</div>
        <div className="footer-contact">
          <strong>Get in touch</strong>
          <a href={contact.phoneHref}><Phone size={16} aria-hidden="true" /> {contact.phone}</a>
          <a href={`mailto:${contact.email}`}><Mail size={16} aria-hidden="true" /> {contact.email}</a>
          <div className="footer-hours"><Clock size={16} aria-hidden="true" /><div>{contact.hours.map(([day, hours]) => <span key={day}><b>{day}:</b> {hours}</span>)}</div></div>
        </div>
      </div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} Seng Guan Auto Sdn. Bhd.</span><a href={contact.inventory} target="_blank" rel="noreferrer">Live inventory on Carlist <ArrowUpRight size={14} aria-hidden="true" /></a></div>
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
  const currentIndex = directions.findIndex((item) => item.id === variant.id)
  const previous = directions[(currentIndex - 1 + directions.length) % directions.length]
  const next = directions[(currentIndex + 1) % directions.length]
  return (
    <aside className={`prototype-dock${detailsOpen ? ' is-expanded' : ''}`} aria-label="Design prototype selector">
      <div className="prototype-details" id="prototype-details" hidden={!detailsOpen}>
        <div className="prototype-details-top"><div><p>Design direction {variant.short} / {directions.length}</p><h2>{variant.name}</h2></div><button type="button" aria-label="Close prototype details" onClick={() => setDetailsOpen(false)}><X size={18} aria-hidden="true" /></button></div>
        <p className="prototype-tagline">{variant.tagline}</p><p className="prototype-layout">Layout: {variant.layout}</p>
        <p className="prototype-skill-heading">Skills used in this direction</p><div className="skill-tags">{variant.skills.map((skill) => <span key={skill}>{skill}</span>)}</div><p className="skill-reason">{variant.skillReason}</p>
        <div className="prototype-detail-actions"><button type="button" className={`button button--small${saved ? ' is-saved' : ''}`} onClick={selectDirection}>{saved ? <><Check size={15} aria-hidden="true" /> Marked for review</> : 'Mark this direction'}</button><button type="button" className="copy-link" onClick={copyDirectionLink}>Copy this option’s link</button></div>
      </div>
      <div className="dock-main">
        <button type="button" className="dock-arrow" aria-label={`Previous direction: ${previous.name}`} onClick={() => goToVariant(previous.id)}><ArrowLeft size={17} aria-hidden="true" /></button>
        <label className="dock-select-wrap"><span>Prototype</span><select aria-label="Choose a design prototype" value={variant.id} onChange={(event) => goToVariant(event.target.value)}>{directions.map((item) => <option key={item.id} value={item.id}>{item.short} / {directions.length} · {item.name}</option>)}</select><ChevronDown size={14} aria-hidden="true" /></label>
        <span className="dock-page">{pages.find((page) => page.id === currentPage)?.label}</span>
        <button type="button" className="dock-arrow" aria-label={`Next direction: ${next.name}`} onClick={() => goToVariant(next.id)}><ArrowRight size={17} aria-hidden="true" /></button>
        <button type="button" className="dock-info" aria-expanded={detailsOpen} aria-controls="prototype-details" onClick={() => setDetailsOpen(!detailsOpen)}>{detailsOpen ? 'Close details' : 'Skills & notes'}</button>
      </div>
      <span className="dock-hint">Use ← / → to compare · state is in the URL</span>
    </aside>
  )
}

export default App
