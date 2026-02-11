import { redirect } from 'next/navigation'

export default function CalendarRedirect() {
  redirect(`/calendar/${new Date().getFullYear()}`)
}
