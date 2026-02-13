import { redirect } from 'next/navigation'

type CalendarYearRedirectProps = {
  params: { year: string }
  searchParams?: { series?: string | string[] }
}

export default function CalendarYearRedirect({ params, searchParams }: CalendarYearRedirectProps) {
  const seriesParam = Array.isArray(searchParams?.series)
    ? searchParams?.series[0]
    : searchParams?.series
  const seriesPath = seriesParam && seriesParam.length > 0 ? seriesParam : 'all'
  redirect(`/calendar/${params.year}/${seriesPath}`)
}
