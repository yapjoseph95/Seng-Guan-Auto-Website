export function formatPublicationDate(date: string, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeZone: 'Asia/Kuala_Lumpur',
  }).format(new Date(date))
}
